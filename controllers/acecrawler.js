"use strict"

const Promise = require('promise');
const cheerio = require('cheerio');
const moment = require('moment');
require('moment-round');
const request = require('request-promise');

if (!String.prototype.format) {
    String.prototype.format = function () {
      var args = arguments;
      return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined'
          ? args[number]
          : match
          ;
      });
    };
  }

module.exports = {
    getBuildingCodes: () => {
        const requestOptions = {
            method: 'GET',
            uri: "https://www.ace.utoronto.ca/webapp/f?p=200:1:::::",
            json: false,
            jar: request.jar()
        };

        let promise = new Promise(function (resolve, reject) {
            request(requestOptions).then(function (response) {
              let $ = cheerio.load(response);
              let buildingCodes = [];
      
              $("#P1_BLDG").children().each(function (i, elem) {
                let code = $(this).attr('value');
                let name = $(this).text().split(" ").slice(1).join(" ").trim();
                buildingCodes[i] = { id: code, name: name };
              });

                resolve(buildingCodes.slice(1));
            }).catch((error) => {
                reject(error);
            });
        });

        return promise;
    },

    getRooms: (buildingCode) => {
        const requestOptions = {
            method: 'GET',
            uri: "https://www.ace.utoronto.ca/webapp/f?p=200:1:::::P1_BLDG:{0}"
            .format(buildingCode),
            json: false,
            jar: request.jar()
        };

        let promise = new Promise(function (resolve, reject) {
            request(requestOptions).then(function (response) {
              let $ = cheerio.load(response);
              let rooms = [];
      
              $("#P1_ROOM").children().each(function (i, elem) {
                rooms[i] = {id: $(this).attr('value'), name: $(this).text().trim()};
              });
                console.log(rooms);

                resolve(rooms.slice(1));
            }).catch((error) => {
                console.log(error);
                reject(error);
            }); 
        });
        
        return promise;
    },

    getWeekSchedule: (buildingCode, roomNumber, dayOfWeek) => {
        let startDate = dayOfWeek.clone().startOf('isoWeek'); //use the same day for every day in the week, for caching purposes
        let myJar = request.jar() //cookie jar for this request
    
        const options = {
          method: 'GET',
          uri: `https://www.ace.utoronto.ca/webapp/f?p=200:1:::::P1_BLDG,P1_ROOM,P1_CALENDAR_DATE:${buildingCode},${roomNumber},${startDate.format("YYYYMMDD")}`,
          json: false,
          jar: myJar
        };
    
        let sched = [];
    
        let promise = new Promise((resolve, reject) => {
          request(options).then((body) => {
    
            //needed to call calendar API
            let ajaxIdentifier = body.match("apex.widget.cssCalendar(.*)}\\)")[1].match("ajaxIdentifier\":\"(.*)\"}")[1];
    
            const calendarApiOptions = {
              method: 'POST',
              uri: 'https://www.ace.utoronto.ca/webapp/wwv_flow.ajax',
              jar: myJar,
              form: {
                p_flow_id: 200,
                p_flow_step_id: 1,
                p_instance: 0,
                p_request: "PLUGIN={0}".format(ajaxIdentifier),
                x01: "GET",
                x02: startDate.format("YYYYMMDD"),
                x03: startDate.add(7, 'days').format("YYYYMMDD")
              }
            };
    
            request(calendarApiOptions).then((body) => {
              let responseSched = JSON.parse(body);
    
              for (let i = 0; i < responseSched.length; i++) {
                let currentTimeSpot = responseSched[i];
                let currentTime = moment(currentTimeSpot.start);
                let endTime = moment(currentTimeSpot.end).minute(0);
    
                while (!currentTime.isSame(endTime, 'hour')) {
                  sched.push({
                    buildingCode: buildingCode,
                    roomNumber: roomNumber,
                    time: currentTime.clone(),
                    name: currentTimeSpot.title
                  });
                  currentTime.add(1, 'hour');
                }
              }
    
              resolve(sched);
    
            }).catch( (err) => {
              reject(err);
            });
          });
    
        });
        return promise;
      }
}