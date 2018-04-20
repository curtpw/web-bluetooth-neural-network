/*
​x=r sin(φ)cos(θ)
​y=r sin(φ)sin(θ)
​z=r cos(φ)
*/
/* DATA SAMPLE TEMPLATE
{
  Thermo1 Object Temp,
  Thermo2 Object Temp,
  Thermo3 Object Temp,
  Thermo4 Object Temp,
  Distance,
  Pitch,
  Roll,
  Acc X,
  Acc Y,
  Acc Z,
  Thermo Ave. Device Temp,
  Time Stamp,
  Hand,
  Target,
  on/off Target Observed
}*/


//sensor data object
var state = {};

    // Web Bluetooth connection -->

$( document ).ready(function() {
    button = document.getElementById("connect");
    message = document.getElementById("message");
});

//connection flag
var bluetoothDataFlag = false;

if ( 'bluetooth' in navigator === false ) {
    button.style.display = 'none';
    message.innerHTML = 'This browser doesn\'t support the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> :(';
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

        //decompress the very crude compression on device side to fit values into BLE data packet
    	let accelerometerX      = (event.target.value.getUint8(0) / 100) - 1;
    	let accelerometerY      = (event.target.value.getUint8(1) / 100) - 1;
    	let accelerometerZ      = (event.target.value.getUint8(2) / 100) - 1;
    	let accelerometerRoll   = (event.target.value.getUint8(3) * 1.41);
    	let accelerometerPitch  = (event.target.value.getUint8(4) * 1.41);
    	let devicePhotosensor  	= (event.target.value.getUint8(5) * 4);
    	let deviceTouchsensor  	= (event.target.value.getUint8(6) * 4);

    console.log(accelerometerRoll + " " + accelerometerPitch);


/*        var data = {
                pitch: accelerometerPitch,
                roll: accelerometerRoll,
                x: accelerometerX,
                y: accelerometerY,
                z: accelerometerZ,
                photosensor: devicePhotosensor,
                touch: deviceTouchsensor
        } */

        state = {
                pitch: accelerometerPitch,
                roll: accelerometerRoll,
                x: accelerometerX,
                y: accelerometerY,
                z: accelerometerZ,
                photosensor: devicePhotosensor,
                touch: deviceTouchsensor

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

    onStateChange(callback) {
        _this.onStateChangeCallback = callback;
    }
}

/*******************************************************************************************************************
 *********************************************** INITIALIZE *********************************************************
 ********************************************************************************************************************/

//sensor array sample data
var sensorDataArray = new Array(12).fill(0);

//sensor array sample data FOR CUSTOM TRAINING
var NN1TrueDataArray = new Array;
var NN1FalseDataArray = new Array;
var NN2TrueDataArray = new Array;
var NN2FalseDataArray = new Array;

var NN1Architecture = 'none';
var NN2Architecture = 'none';

var NN1NumInputs = 3;
var NN2NumInputs = 3;

//master session data array of arrays
var sensorDataSession = [];

//which samples in the session data array are part of a particular sample set
var sessionSampleSetIndex = [];

var getSamplesFlag = 0;
var getSamplesTypeFlag = 0; //0=none 1=NN1T 2=NN1F 3=NN2T 4=NN2F

//do we have a trained NN to apply to live sensor data?
var haveNNFlag1 = false;
var trainNNFlag1 = false;
var activeNNFlag1 = false;

var haveNNFlag2 = false;
var trainNNFlag2 = false;
var activeNNFlag2 = false;

var loadNNFlag = false;

//NN scores
var scoreArray = new Array(1).fill(0);

var initialised = false;
var timeout = null;

$(document).ready(function() {

    /*******************************************************************************************************************
     *********************************************** WEB BLUETOOTH ******************************************************
     ********************************************************************************************************************/

    //Web Bluetooth connection button and ongoing device data update function
    button.onclick = function(e) {
        var sensorController = new ControllerWebBluetooth("Tingle");
        sensorController.connect();

        //ON SENSOR DATA UPDATE
        sensorController.onStateChange(function(state) {
            bluetoothDataFlag = true;
        });

        //check for new data every X milliseconds - this is to decouple execution from Web Bluetooth actions
        setInterval(function() {
            //     bluetoothDataFlag = getBluetoothDataFlag();

            if (bluetoothDataFlag == true) {

                timeStamp = new Date().getTime();

                //load data into global array
                sensorDataArray = new Array(12).fill(0);

                sensorDataArray[0] = state.x.toFixed(2);
                sensorDataArray[1] = state.y.toFixed(2);
                sensorDataArray[2] = state.z.toFixed(2);
                sensorDataArray[3] = state.pitch.toFixed(1);
                sensorDataArray[4] = state.roll.toFixed(1);

                sensorDataArray[5] = state.photosensor.toFixed(1);
                sensorDataArray[6] = state.touch.toFixed(1);
                sensorDataArray[7] = 0;
                sensorDataArray[8] = 0;
                sensorDataArray[9] = 0;
                sensorDataArray[10] = 0;
                sensorDataArray[11] = timeStamp;


                //update time series chart with normalized values
                var rawAccXChart = ((sensorDataArray[0] + 2) / 4);
                var rawAccYChart = ((sensorDataArray[1] + 2) / 4);
                var rawAccZChart = ((sensorDataArray[2] + 2) / 4);

                var rawPitchChart = (sensorDataArray[3] / 361);
                var rawRollChart = (sensorDataArray[4] / 361);

                var rawPhotoChart = (sensorDataArray[5] / 1025); //TEMPORARY


                //sensor values in bottom 2/3 of chart , 1/10 height each
                rawAccXChart = (rawAccXChart / 6) + 7 * 0.1;
                rawAccYChart = (rawAccYChart / 6) + 6.5 * 0.1;
                rawAccZChart = (rawAccZChart / 6) + 6 * 0.1;

                rawPhotoChart = (rawPhotoChart / 10) + 5 * 0.1;

                rawPitchChart = (rawPitchChart / 3) + 3 * 0.1;
                rawRollChart = (rawRollChart / 3) + 2 * 0.1;


                lineAccX.append(timeStamp, rawAccXChart);
                lineAccY.append(timeStamp, rawAccYChart);
                lineAccZ.append(timeStamp, rawAccZChart);
                linePitch.append(timeStamp, rawPitchChart);
                lineRoll.append(timeStamp, rawRollChart);
                linePhoto.append(timeStamp, rawPhotoChart);


                //if data sample collection has been flagged
                //  getSensorData();
                if (getSamplesFlag > 0) {
                    collectData();
                } else if (trainNNFlag1 || trainNNFlag2) {
                    //don't do anything
                } else {
                    if (haveNNFlag1 && activeNNFlag1) { //we have a NN and we want to apply to current sensor data
                        getNNScore(1);
                    } 
                    if (haveNNFlag2 && activeNNFlag2) { //we have a NN and we want to apply to current sensor data
                        getNNScore(2);
                    } 
                }

                displayData();

                bluetoothDataFlag = false;
            }

        }, 200); // throttle 100 = 10Hz limit
    }


    /*******************************************************************************************************************
    **************************************** STREAMING SENSOR DATA CHART ***********************************************
    *******************************************************************************************************************/

    //add smoothie.js time series streaming data chart
    var chartHeight = 350;
    var chartWidth = $(window).width();

    $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');

    var streamingChart = new SmoothieChart({/*  grid: { strokeStyle:'rgb(125, 0, 0)', fillStyle:'rgb(60, 0, 0)', lineWidth: 1, millisPerLine: 250, verticalSections: 6, }, labels: { fillStyle:'rgb(60, 0, 0)' } */ });

    streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );

    var lineAccX = new TimeSeries();
    var lineAccY = new TimeSeries();
    var lineAccZ = new TimeSeries();
    var linePitch = new TimeSeries();
    var lineRoll = new TimeSeries();
    var linePhoto = new TimeSeries();
    var lineNN1 = new TimeSeries();
    var lineNN2 = new TimeSeries();

    streamingChart.addTimeSeries(lineAccX,  {strokeStyle: 'rgb(185, 156, 107)', lineWidth: 3 });
    streamingChart.addTimeSeries(lineAccY,  {strokeStyle: 'rgb(143, 59, 27)',   lineWidth: 3 });
    streamingChart.addTimeSeries(lineAccZ,  {strokeStyle: 'rgb(213, 117, 0)',   lineWidth: 3 });
    streamingChart.addTimeSeries(linePitch, {strokeStyle: 'rgb(128, 128, 128)', lineWidth: 4 });
    streamingChart.addTimeSeries(linePhoto,  {strokeStyle: 'rgb(206, 66, 244)', lineWidth: 3 }); 
    streamingChart.addTimeSeries(lineRoll,  {strokeStyle: 'rgb(240, 240, 240)', lineWidth: 4 });
    streamingChart.addTimeSeries(lineNN1,   {strokeStyle: 'rgb(72, 244, 68)',   lineWidth: 4 });
    streamingChart.addTimeSeries(lineNN2,   {strokeStyle: 'rgb(244, 66, 66)',   lineWidth: 4 });

    //min/max streaming chart button
    $('#circleDrop').click(function() {

        $('.card-middle').slideToggle();
        $('.close').toggleClass('closeRotate');

        var chartHeight = $(window).height() / 1.2;
        var chartWidth = $(window).width();

        if ($("#chart-size-button").hasClass('closeRotate')) {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');
        } else {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + 100 + '"></canvas>');
        }

        //hide controls
        $("#basic-interface-container, #hand-head-ui-container, #nn-slide-controls, .console, #interface-controls, #dump-print, #record-controls").toggleClass("hide-for-chart");
        //redraw chart
        streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );
    });

    //numerical data display
    function displayData() {
        var accelerometerElement1 =    document.getElementsByClassName('accelerometer-x-data')[0];
        var accelerometerElement2 =    document.getElementsByClassName('accelerometer-y-data')[0];
        var accelerometerElement3 =    document.getElementsByClassName('accelerometer-z-data')[0];
        var accelerometerPitchDiv = document.getElementsByClassName('accelerometer-pitch-data')[0];
        var accelerometerRollDiv =  document.getElementsByClassName('accelerometer-roll-data')[0];
        var photosensorRollDiv =  document.getElementsByClassName('photosensor-data')[0];

        accelerometerElement1.innerHTML =      	sensorDataArray[0];
        accelerometerElement2.innerHTML =      	sensorDataArray[1];
        accelerometerElement3.innerHTML =      	sensorDataArray[2];
        accelerometerPitchDiv.innerHTML =  		sensorDataArray[3];
        accelerometerRollDiv.innerHTML 	=    	sensorDataArray[4];
        photosensorRollDiv.innerHTML 	=    	sensorDataArray[5];
    }

    function getSensorData() {
        if (state.accelerometer) {
            sensorDataArray[0] = state.x.toFixed(2);
            sensorDataArray[1] = state.y.toFixed(2);
            sensorDataArray[2] = state.z.toFixed(2);
            sensorDataArray[3] = state.pitch.toFixed(2);
            sensorDataArray[4] = state.roll.toFixed(2);
            sensorDataArray[5] = state.photosensor.toFixed(2);
        }
    } 

    function collectData() {
        var collectedDataArray = new Array(12).fill(0); //12 device 
        collectedDataArray = sensorDataArray;

        console.log("web bluetooth sensor data:");
        console.dir(collectedDataArray);

        //add sample to set
        sensorDataSession.push(collectedDataArray);

        if (getSamplesTypeFlag == 1) {
            NN1TrueDataArray.push(collectedDataArray);
            $('.message-nn1-true').html(NN1TrueDataArray.length);
        } else if (getSamplesTypeFlag == 2) {
            NN1FalseDataArray.push(collectedDataArray);
            $('.message-nn1-false').html(NN1FalseDataArray.length);
        } else if (getSamplesTypeFlag == 3) {
            NN2TrueDataArray.push(collectedDataArray);
            $('.message-nn2-true').html(NN2TrueDataArray.length);
        } else if (getSamplesTypeFlag == 4) {
            NN2FalseDataArray.push(collectedDataArray);
            $('.message-nn2-false').html(NN2FalseDataArray.length);
        }

        console.log("Set Index: ");
        console.dir(sessionSampleSetIndex);

        //countdown for data collection
        getSamplesFlag = getSamplesFlag - 1;
    }


    /*******************************************************************************************************************
     *********************************************** NEURAL NETWORKS ****************************************************
     ********************************************************************************************************************/
    /**
     * Attach synaptic neural net components to app object
     */
    var nnRate =        $("#rate-input").val();
    var nnIterations =  $("#iterations-input").val();
    var nnError =       $("#error-input").val();

    // ************** NEURAL NET #1
    var Neuron = synaptic.Neuron;
    var Layer = synaptic.Layer;
    var Network = synaptic.Network;
    var Trainer = synaptic.Trainer;
    var Architect = synaptic.Architect;
    var neuralNet = new Architect.LSTM(3, 3, 3, 1);
    var trainer = new Trainer(neuralNet);
    var trainingData;

    // ************* NEURAL NET #2
    var Neuron2 = synaptic.Neuron;
    var Layer2 = synaptic.Layer;
    var Network2 = synaptic.Network;
    var Trainer2 = synaptic.Trainer;
    var Architect2 = synaptic.Architect;
    var neuralNet2 = new Architect2.LSTM(3, 3, 3, 1);
    var trainer2 = new Trainer2(neuralNet2);
    var trainingData2;


    function getNNScore(selectNN) {
        var feedArray = new Array(1).fill(0);
        var scoreArray = new Array(1).fill(0);
        var timeStamp = new Date().getTime();
        var displayScore;

        if ((selectNN == 1 && NN1NumInputs == 2) || (selectNN == 2 && NN2NumInputs == 2)) {
            feedArray[0] = sensorDataArray[3] / 360;
            feedArray[1] = sensorDataArray[4] / 360;
        }

        if ((selectNN == 1 && NN1NumInputs == 3) || (selectNN == 2 && NN2NumInputs == 3)) {
            feedArray[0] = sensorDataArray[3] / 360;
            feedArray[1] = sensorDataArray[4] / 360;
            feedArray[2] = (sensorDataArray[5] + 2) / 4;
        }

        // use trained NN or loaded NN
        if (haveNNFlag1 && activeNNFlag1 && selectNN == 1) {
            scoreArray = neuralNet.activate(feedArray);
        } else if (loadNNFlag && selectNN == 1) {
            scoreArray = neuralNetwork1(feedArray);
        }

        if (haveNNFlag2 && activeNNFlag2 && selectNN == 2) {
            scoreArray = neuralNet2.activate(feedArray);
        } else if (loadNNFlag && selectNN == 2) {
            scoreArray = neuralNetwork2(feedArray);
        }

        displayScore = scoreArray[0].toFixed(4) * 100;
        displayScore = displayScore.toFixed(2);

        if (selectNN == 1) {
            console.log("NN1 FEED ARRAY: " + feedArray);
            console.log("NN1 SCORE ARRAY: " + scoreArray);
            $(".message-nn1-score").html(displayScore + '%');
            var rawLineNN1Chart = scoreArray[0].toFixed(4);
            rawLineNN1Chart = (rawLineNN1Chart / 3) + 0.8;
            lineNN1.append(timeStamp, rawLineNN1Chart);

        } else if (selectNN == 2) {
            console.log("NN2 FEED ARRAY: " + feedArray);
            console.log("NN2 SCORE ARRAY: " + scoreArray);
            $(".message-nn2-score").html(displayScore + '%');
            var rawLineNN2Chart = scoreArray[0].toFixed(4);
            rawLineNN2Chart = (rawLineNN2Chart / 3) + 0.8;
            lineNN2.append(timeStamp, rawLineNN2Chart);
        }
    }



    /**************************** TRAIN NN ******************************/
    function trainNN(selectNN) {
        //'2:1', '2:5:1', '2:5:5:1', '3:1', '3:5:1', '3:5:5:1', '5:5:1', '5:7:7:1'
        //  var processedDataSession = sensorDataSession;
        var processedDataSession = new Array;
        var falseDataArray = new Array;
        var trueDataArray = new Array;
        var combinedTrueFalse = new Array(13).fill(0);
        trainingData = new Array;

        var rawNNArchitecture = $(".range-slider__value.nn-architecture").html();
        var numInputs = parseInt(rawNNArchitecture.charAt(0));

        nnRate = $("#rate-input").val();
        nnIterations = $("#iterations-input").val();
        nnError = $("#error-input").val();

        if (selectNN == 1) {
            trueDataArray = NN1TrueDataArray;
            falseDataArray = NN1FalseDataArray;
        } else if (selectNN == 2) {
            trueDataArray = NN2TrueDataArray;
            falseDataArray = NN2FalseDataArray;
        }

        //combine true and false data
        for (var j = 0; j < trueDataArray.length; j++) {
            combinedTrueFalse = trueDataArray[j];
            combinedTrueFalse[12] = 1; //true
            processedDataSession.push(combinedTrueFalse);
        }
        for (var k = 0; k < falseDataArray.length; k++) {
            combinedTrueFalse = falseDataArray[k];
            combinedTrueFalse[12] = 0; //false
            processedDataSession.push(combinedTrueFalse);
        }

        

        var getArchitect;
        if (rawNNArchitecture == '2:1') {
            getArchitect = new Architect.LSTM(2, 1);
        } else if (rawNNArchitecture == '2:5:5:1') {
            getArchitect = new Architect.LSTM(2, 5, 5, 1);
        } else if (rawNNArchitecture == '3:1') {
            getArchitect = new Architect.LSTM(3, 1);
        } else if (rawNNArchitecture == '3:3:1') {
            getArchitect = new Architect.LSTM(3, 3, 1);
        } else if (rawNNArchitecture == '3:3:3:1') {
            getArchitect = new Architect.LSTM(3, 3, 3, 1);
        } else if (rawNNArchitecture == '3:5:5:1') {
            getArchitect = new Architect.LSTM(3, 5, 5, 1);
        } 

        if (selectNN == 1) {
            neuralNet = getArchitect;
            NN1Architecture = rawNNArchitecture;
            NN1NumInputs = numInputs;
            trainer = new Trainer(neuralNet);
        } else {
            neuralNet2 = getArchitect;
            NN2Architecture = rawNNArchitecture;
            NN2NumInputs = numInputs;
            trainer2 = new Trainer2(neuralNet2);
        }

        //   console.log("raw NN architecture: " + rawNNArchitecture);

        //  console.log("SIZE OF UNPROCESSED SESSION DATA: " + processedDataSession.length);

        for (var i = 0; i < processedDataSession.length; i++) {

            var currentSample = processedDataSession[i];
            var outputArray = new Array(1).fill(0);
            var inputArray = new Array(2).fill(0);

            outputArray[0] = currentSample[12]; //true or false

            if (numInputs == 3) {
                inputArray[0] = currentSample[3] / 360;
                inputArray[1] = currentSample[4] / 360;
                inputArray[2] = (currentSample[2] + 2) / 4;

            } else if (numInputs == 2) {
                inputArray[0] = currentSample[3] / 360;
                inputArray[1] = currentSample[4] / 360;
            }

            trainingData.push({
                input: inputArray,
                output: outputArray
            });

            console.log(currentSample + " TRAINING INPUT: " + inputArray + "  --> NN# " + selectNN);
            console.log(currentSample + " TRAINING OUTPUT: " + outputArray + "  --> NN# " + selectNN);
        }


        if (selectNN == 1) {
            console.log("TRAINING ON selectNN1 --> interations:" + nnIterations + "  error:" + nnError + "  rate:" + nnRate + "  arch:" + rawNNArchitecture + "  inputs:" + numInputs);

            trainer.train(trainingData, {
                rate: nnRate,
                //   iterations: 15000,
                iterations: nnIterations,
                error: nnError,
                shuffle: true,
                //   log: 1000,
                log: 5,
                cost: Trainer.cost.CROSS_ENTROPY
            });

            //we have a trained NN to use
            haveNNFlag1 = true;
            trainNNFlag1 = false;
            $('#activate-btn').addClass("haveNN");
            $('#export-btn').addClass("haveNN");

        } else if (selectNN == 2) {
            console.log("TRAINING ON selectNN2");

            trainer2.train(trainingData, {
                rate: nnRate,
                //   iterations: 15000,
                iterations: nnIterations,
                error: nnError,
                shuffle: true,
                //   log: 1000,
                log: 5,
                cost: Trainer2.cost.CROSS_ENTROPY
            });

            //we have a trained NN to use
            haveNNFlag2 = true;
            trainNNFlag2 = false;
            $('#activate2-btn').addClass("haveNN");
            $('#export2-btn').addClass("haveNN");
        }
    }


    /*******************************************************************************************************************
     *********************************************** SLIDER UI ******************************************************
     ********************************************************************************************************************/
    var rangeSlider = function(){
        var slider = $('.range-slider'),
            range = $('.range-slider__range'),
            value = $('.range-slider__value');
          
        slider.each(function(){

        value.each(function(){
            var value = $(this).prev().attr('value');
            $(this).html(value);
        });

        if( $(this).hasClass('nn-architecture') ){ $('.range-slider__value.nn-architecture').html('3:3:3:1'); }

        range.on('input', function(){
            var labels = ['2:1', '2:5:5:1', '3:1', '3:3:1', '3:3:3:1', '3:5:5:1'];
            $(this).next(value).html(this.value);

            if( $(this).hasClass('nn-architecture') ){ $(this).next(value).html( labels[this.value] ); }
          
          });
        });
    }

    rangeSlider();

    //RANGE SLIDER EVENT HANDLER
    $( ".range-slider" ).each(function() {

        if($(this).hasClass("nn-architecture")){
            // Add labels to slider whose values 
            // are specified by min, max and whose
            // step is set to 1
            
            // Get the options for this slider
            //var opt = $(this).data().uiSlider.options;
            // Get the number of possible values
            var $input = $(this).find("input");
            var min = parseInt($input.attr("min"));
            var max = parseInt($input.attr("max"));
            var step = parseInt($input.attr("step"));
            var increment = parseInt($input.attr("increment"));
            var vals = max - min; //opt.max - opt.min;
            //if(min < 0){ vals = max + min; }
            var labels = ['2:1', '2:5:5:1', '3:1', '3:3:1', '3:3:3:1', '3:5:5:1'];
            
            // Space out values
            for (var i = 0; (i * increment) <= vals; i++) {
                var s = min + (i * increment);
                var el = $('<label>'+ labels[s] +'</label>').css('left',( 4 + Math.abs((s-min)/vals) *($input.width() -24)+'px'));
                //   var el = $('<label>'+ s +'</label>').css('left',( 3 + ((s-min)/vals) *($input.width() -24)+'px'));
                if(s == 0){ el = $('<label>'+ labels[s] +'</label>').css('left',( 21 + Math.abs((s-min)/vals) *($input.width() -24)+'px')); }
                if(s == vals){ el = $('<label>'+ labels[s] +'</label>').css('left',( -20 + Math.abs((s-min)/vals) *($input.width() -24)+'px')); }
                $(this).append(el);
            }
        }  
    });


    /*******************************************************************************************************************
     ******************************************* NEURAL NETWORK BUTTONS *************************************************
     ********************************************************************************************************************/
    $('#train-btn').click(function() {
        console.log("train button 1");
        trainNNFlag1 = true;
        trainNN(1);
    });

    $('#activate-btn').click(function() {
        console.log("activate button");
        activeNNFlag1 = true;
        $('#activate-btn').toggleClass("activatedNN");

        //if loaded NN, turn off
        if (loadNNFlag) {
            loadNNFlag = false;
            $('#load-nn-btn').toggleClass("activatedNN");
        }
    });

    $('#train2-btn').click(function() {
        console.log("train button 2");
        trainNNFlag2 = true;
        trainNN(2);
    });

    $('#activate2-btn').click(function() {
        console.log("activate button");
        activeNNFlag2 = true;
        $('#activate2-btn').toggleClass("activatedNN");

        //if leaded NN, turn off
        if (loadNNFlag) {
            loadNNFlag = false;
            $('#load-nn-btn').toggleClass("activatedNN");
        }
    });


    // ************* LOAD TWO EXPORTED NEURAL NET ACTIVATION FUNCTIONS AND WEIGHTS
    $('#load-nn-btn').click(function() {
        console.log("load exported NN button");
        loadNNFlag = true;
        $('#load-nn-btn').toggleClass("activatedNN");
    });
    /*******************************************************************************************************************
     ********************************** COLLECT, PRINT, LOAD BUTTON ACTIONS *********************************************
     ********************************************************************************************************************/

    /*************** COLLECT SAMPLE - SONSOR AND MODEL DATA - STORE IN GSHEET AND ADD TO NN TRAINING OBJECT *****************/
    $('#collect-true-1').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 1;
        console.log("Collect btn NN1T #samples flag: " + getSamplesFlag);
    });

    $('#collect-false-1').click(function() {
        //how many samples for this set?
        //this flag is applied in the bluetooth data notification function
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 2;
        console.log("Collect btn NN1F #samples flag: " + getSamplesFlag);
    });

    $('#collect-true-2').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        //this flag is applied in the bluetooth data notification function
        getSamplesTypeFlag = 3;
        console.log("Collect btn NN2T #samples flag: " + getSamplesFlag);
    });

    $('#collect-false-2').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        //this flag is applied in the bluetooth data notification function
        getSamplesTypeFlag = 4;
        console.log("Collect btn NN2F #samples flag: " + getSamplesFlag);
    });

    $('#clear-1').click(function() {
        NN1TrueDataArray = new Array;
        NN1FalseDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        $('.message-nn1-true').html('');
        $('.message-nn1-false').html('');
        $("#dump-print").html("");
        console.log("Clear NN1 Data");
    });

    $('#clear-2').click(function() {
        NN2TrueDataArray = new Array;
        NN2FalseDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        $('.message-nn2-true').html('');
        $('.message-nn2-false').html('');
        $("#dump-print").html("");
        console.log("Clear NN2 Data");
    });

    $('#export-btn').click(function() {
        console.log("export1 NN button");
        //clear everything but key values from stored NN
        neuralNet.clear();

        //export optimized weights and activation function
        var standalone = neuralNet.standalone();

        //convert to string for parsing
        standalone = standalone.toString();

        console.log(standalone);
        $("#dump-print").html(standalone);
        $("#dump-print").addClass("active-print");
    });

    $('#export2-btn').click(function() {
        console.log("export2 NN button");
        //clear everything but key values from stored NN
        neuralNet2.clear();

        //export optimized weights and activation function
        var standalone = neuralNet2.standalone();

        //convert to string for parsing
        standalone = standalone.toString();

        console.log(standalone);
        $("#dump-print").html(standalone);
        $("#dump-print").addClass("active-print");
    });

}); // end on document load
//}