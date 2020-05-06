var utils = require('util');
var events = require('events');
var spawn = require('child_process').spawn;

utils.inherits(Job, events.EventEmitter);

function Job(lp) {

  var self = this;
  var error;

  lp.stderr.on('data', function(data) {
    error = data.slice(0, data.length - 1);
  });

  lp.stdout.on('data', function(data) {
    self.identifier = parseInt(data
      .toString()
      .match(/^request id is .*-(\d+)/)[1]);
  });

  lp.on('exit', function(code) {
    if (0 === code) {
      self.emit('sent', self.identifier);
    }
    else {
      self.emit('error', error);
    }
  });
}

Job.prototype.update = function(status) {
  this.status = status;
  this.emit('updated', status);
};

Job.prototype.unqueue = function() {
  if (this.status && this.status.rank === 'active') {
    this.status.rank = 'completed';
    this.emit('completed');
  }
};

Job.prototype.cancel = function() {
  var self = this;
  var lprm = spawn('lprm', [self.identifier]);
  lprm.on('exit', function(code) {
    if (0 === code) self.emit('deleted');
  });
};

module.exports = Job;
