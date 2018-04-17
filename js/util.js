
var Util = Util || {};

Util.setupThumbnails = function(tableID, picsArray, basePath, tag) {

    var thumbsTable = $("#" + tableID);

    var picsArray = picsArray;
    var basePath = basePath;

    var picCount = picsArray.length;
    var rowCount = Math.ceil(picCount / 2);

    var oddCount = false;
    if (rowCount * 2 != picCount) oddCount = true;

    for (var i = 0; i < rowCount; i++) {

        var newRow, leftCell, leftImgLink, leftImg, 
            rightCell, rightImgLing, rightImg;

        newRow = $("<tr></tr>");
        thumbsTable.append(newRow);

        var leftPic = basePath + "/thumbnails/" + picsArray[i * 2];
        var rightPic = basePath + "/thumbnails/" + picsArray[i * 2 + 1];

        var leftPicFull = basePath + "/" + picsArray[i * 2];
        var rightPicFull = basePath + "/" + picsArray[i * 2 + 1];

        leftCell = $("<td width='50%' class='alignCenter'></td>");
        leftImgLink = $("<a href='" + leftPicFull + "' class='fancybox' rel='" + tag + "'></a>");
        leftImg = $("<img class='picBox' style='width:90%' src='" + leftPic + "'/>");

        newRow.append( leftCell );
        leftCell.append( leftImgLink );
        leftImgLink.append( leftImg );

        if (i == rowCount - 1 && oddCount) {

            rightCell = $("<td width='50%' class='alignCenter'></td>");
            newRow.append( rightCell );

        } else {

            rightCell = $("<td width='50%' class='alignCenter'></td>");
            rightImgLink = $("<a href='" + rightPicFull + "' class='fancybox' rel='" + tag + "'></a>");
            rightImg = $("<img class='picBox' style='width:90%' src='" + rightPic + "'/>");

            newRow.append( rightCell );
            rightCell.append( rightImgLink );
            rightImgLink.append( rightImg );

        }
    
        thumbsTable.append($("<tr><td colspan='2' style='height:25px'></tr>"));
    }

}