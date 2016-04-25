'use strict';

var crypto = require('crypto');

var Utils = {
  getDiffFromNow: function (then) {
    return (new Date()).getTime() - then.getTime();
  },

  formatMs: function (time) {
    let seconds = Math.floor(time/1000),
        minutes = Math.floor(seconds/60);

    seconds = Utils.datePad(seconds % 60);

    return `${ minutes }:${ seconds }`;
  },

  datePad: function (number) {
    return number < 10 ? `0${ number }` : number;
  },

  formatDate: function (dateString) {
    let date = new Date(dateString);

    return `${ date.getFullYear() }-${ Utils.datePad(date.getMonth() + 1) }-${ date.getDate() }`;
  },

  getMD5Hash: function (data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }
};

module.exports = exports = Utils;
