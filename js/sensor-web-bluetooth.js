
//default active hand is left
var activeHand = "L"; 
//single target
var activeTarget = "none"; 

var targetCommand = 0;



      if ( 'bluetooth' in navigator === false ) {
          button.style.display = 'none';
          message.innerHTML = 'This browser doesn\'t support the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> :(';
      }

//Send target configuration for pre-trained neural networks on device
function getConfig() {
    activeTarget = $("#selected-targets").attr("target");

    if ($("#hand-btn").hasClass("right-active")) {
        activeHand = "R";
    } else {
        activeHand = "L";
    }

    //target selection
    if (activeTarget == "none") {
        targetCommand = 0;
    } else if (activeTarget == "mouth") {
        targetCommand = 1;
    } else if (activeTarget == "front") {
        targetCommand = 2;
    } else if (activeTarget == "top") {
        targetCommand = 3;
    } else if (activeTarget == "back") {
        targetCommand = 4;
    } else if (activeTarget == "right") {
        targetCommand = 5;
    } else if (activeTarget == "left") {
        targetCommand = 6;
    }

    if (activeHand == "R") targetCommand = targetCommand + 10;
    //});
}

const services = {
    controlService: {
        name: 'control service',
        uuid: '0000a000-0000-1000-8000-00805f9b34fb'
    }
}

const characteristics = {
    commandReadCharacteristic: {
        name: 'command read characteristic',
        uuid: '0000a001-0000-1000-8000-00805f9b34fb'
    },
    commandWriteCharacteristic: {
        name: 'command write characteristic',
        uuid: '0000a002-0000-1000-8000-00805f9b34fb'
    },
    deviceDataCharacteristic: {
        name: 'imu data characteristic',
        uuid: '0000a003-0000-1000-8000-00805f9b34fb'
    }
}

var _this;
var state = {};
var previousPose;

var sendCommandFlag = false; //global to keep track of when command is sent back to device
//let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);   //command to send back to device
let commandValue = new Uint8Array([0x99]); //command to send back to device

class ControllerWebBluetooth {
    constructor(name) {
        _this = this;
        this.name = name;
        this.services = services;
        this.characteristics = characteristics;

        this.standardServer;
    }

    connect() {
        return navigator.bluetooth.requestDevice({
                filters: [{
                        name: this.name
                    },
                    {
                        services: [services.controlService.uuid]
                    }
                ]
            })
            .then(device => {
                console.log('Device discovered', device.name);
                return device.gatt.connect();
            })
            .then(server => {
                console.log('server device: ' + Object.keys(server.device));

                this.getServices([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], server);
            })
            .catch(error => {
                console.log('error', error)
            })
    }

    getServices(requestedServices, requestedCharacteristics, server) {
        this.standardServer = server;

        requestedServices.filter((service) => {
            if (service.uuid == services.controlService.uuid) {
                _this.getControlService(requestedServices, requestedCharacteristics, this.standardServer);
            }
        })
    }

    getControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        // Before having access to IMU, EMG and Pose data, we need to indicate to the Myo that we want to receive this data.
        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,imu_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                //  let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);
                //this could be config info to be sent to the wearable device
                let commandValue = new Uint8Array([0x99]);
                //   characteristic.writeValue(commandValue); //disable initial write to device
            })
            .then(_ => {

                let deviceDataChar = requestedCharacteristics.filter((char) => {
                    return char.uuid == characteristics.deviceDataCharacteristic.uuid
                });

                console.log('getting service: ', controlService[0].name);
                _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                console.log('error: ', error);
            })
    }

    sendControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        // Before having access to sensor, we need to indicate to the Tingle that we want to receive this data.
        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting write command to device characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,imu_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                let commandValue = new Uint8Array([0x99]);
                getConfig();
                commandValue[0] = targetCommand;

                console.log("CONFIG target:" + activeTarget + "  command:" + commandValue[0]);
                characteristic.writeValue(commandValue);
            })
            .then(_ => {

                //  let deviceDataChar = requestedCharacteristics.filter((char) => {return char.uuid == characteristics.deviceDataCharacteristic.uuid});
                console.log("COMMAND SENT TO DEVICE");
                sendCommandFlag = false;
                //   console.log('getting service: ', controlService[0].name);
                //  _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                sendCommandFlag = false;
                console.log("COMMAND SEND ERROR");
                console.log('error: ', error);
            })
    }


    handleDeviceDataChanged(event) {
        //byteLength of deviceData DataView object is 20.
        // deviceData return {{orientation: {w: *, x: *, y: *, z: *}, accelerometer: Array, gyroscope: Array}}

        let deviceData = event.target.value;

    let accelerometerRoll   = (event.target.value.getUint8(0) );
    let accelerometerPitch  = (event.target.value.getUint8(1) );

    let proximity           = (event.target.value.getUint8(2) );

    let objectTemp1         = (event.target.value.getUint8(3) / 8) + 70;
    let objectTemp2         = (event.target.value.getUint8(4) / 8) + 70;
    let objectTemp3         = (event.target.value.getUint8(5) / 8) + 70;
    let objectTemp4         = (event.target.value.getUint8(6) / 8) + 70;

    let ambientAverage      = (event.target.value.getUint8(7) / 8) + 70;

    batteryVoltage          = (event.target.value.getUint8(8) );

    let deviceCommand       = (event.target.value.getUint8(9) );

    let accelerometerX      = (event.target.value.getUint8(10) / 100) - 1;
    let accelerometerY      = (event.target.value.getUint8(11) / 100) - 1;
    let accelerometerZ      = (event.target.value.getUint8(12) / 100) - 1;

    let heartRateRaw        = (event.target.value.getUint8(0) );

        console.log(accelerometerRoll + " " + accelerometerPitch + " " + proximity + " " + objectTemp1 + " " + objectTemp2 + " " + objectTemp3 + " " + objectTemp4 + " " + ambientAverage + " " + batteryVoltage);


        var data = {
            accelerometer: {
                pitch: accelerometerPitch,
                roll: accelerometerRoll,
                x: accelerometerX,
                y: accelerometerY,
                z: accelerometerZ
            },
            objectTemp: {
                a: objectTemp1,
                b: objectTemp2,
                c: objectTemp3,
                d: objectTemp4
            },
            ambientTemp: {
                a: ambientAverage
            },
            proximityData: {
                a: proximity
            },
            heartRate: {
                a: heartRateRaw
            }
        }

        state = {
            orientation: data.orientation,
            accelerometer: data.accelerometer,
            objectTemp: data.objectTemp,
            ambientTemp: data.ambientTemp,
            proximityData: data.proximityData,
            heartRate: data.heartRate
        }

        //move this out of state change 
        if (sendCommandFlag) {
            //this.standardServer = server;
            for (var i = 0; i < 3; i++) {
                //  sendControlService();
                _this.sendControlService([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], _this.standardServer);
            }
            sendCommandFlag = false;
        }

        _this.onStateChangeCallback(state);
    }

    onStateChangeCallback() {}

    getdeviceData(service, characteristic, server) {
        return server.getPrimaryService(service.uuid)
            .then(newService => {
                console.log('getting characteristic: ', characteristic.name);
                return newService.getCharacteristic(characteristic.uuid)
            })
            .then(char => {
                char.startNotifications().then(res => {
                    char.addEventListener('characteristicvaluechanged', _this.handleDeviceDataChanged);
                })
            })
    }



    /*  eventArmSynced(arm, x_direction){
        armType = (arm == 1) ? 'right' : ((arm == 2) ? 'left' : 'unknown');
        Direction = (x_direction == 1) ? 'wrist' : ((x_direction == 2) ? 'elbow' : 'unknown');

        state.armType = armType;
        state.myoDirection = myoDirection;

        _this.onStateChangeCallback(state);
      } */

    onStateChange(callback) {
        _this.onStateChangeCallback = callback;
    }


}