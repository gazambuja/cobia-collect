var jsonrrd = require('../lib/json-rrd.js')
var mongodb = require('mongodb');
var crypto = require('crypto');

// incomingData from listener
exports.incomingData = function (db, data, host) {
    if (db && data.load) {

        var o = {};
        o.hostId = host._id;
        o.collector = 'system';
        o.status = [];

        // create hash for one minute load
        var idhL = crypto.createHash('md5').update('loadone').digest('hex');
        o.status.push({'hash':idhL,'hashTitle':'System Load (1m)','overviewText':'load '+data.load.one+' '+data.load.five+' '+data.load.fifteen+', processes: '+data.load.processCount,'alert':0});

        // update rrd with hash
        db.collection('systemCollector', function (err, collection) {
            collection.find({'hostId':host._id,'hash':idhL}).toArray(function(err, docs) {
                if (docs.length>0) {
                    var d = docs[0].d;
                } else {
                    var d = {};
                }
                d = jsonrrd.update(5*60, 24*60/5, 'GAUGE', data.load.one, d);
                collection.update({'hostId':host._id,'hash':idhL},{'$set':{'hostId':host._id,'hash':idhL,'d':d}}, {'safe':false,'upsert':true}, function (err, objects) {
                });
            });
        });

        // create hash for memory
        idhM = crypto.createHash('md5').update('memoryfree').digest('hex');
        o.status.push({'hash':idhM,'hashTitle':'Free Memory','overviewText':'memory total: '+data.memory.total+', free: '+data.memory.free+', buffers: '+data.memory.buffers+', cached: '+data.memory.cached,'alert':0});

        // update rrd with hash
        db.collection('systemCollector', function (err, collection) {
            collection.find({'hostId':host._id,'hash':idhM}).toArray(function(err, docs) {
                if (docs.length>0) {
                    var d = docs[0].d;
                } else {
                    var d = {};
                }
                d = jsonrrd.update(5*60, 24*60/5, 'GAUGE', data.memory.free, d);
                collection.update({'hostId':host._id,'hash':idhM},{'$set':{'hostId':host._id,'hash':idhM,'d':d}}, {'safe':false,'upsert':true}, function (err, objects) {
                });
            });
        });

        // loop through each disk
        for (i=0; i<data.disks.length; i++) {
            // check that data is real
            if (data.disks[i] != undefined) {
                var idh = crypto.createHash('md5').update('mount::'+data.disks[i].mount).digest('hex');
                var t = {'hash':null,'hashTitle':'Free Disk Space on '+data.disks[i].mount,'overviewText':'mount '+data.disks[i].mount+' - used: '+data.disks[i].used+', avail: '+data.disks[i].avail,'alert':0};
                o.status.push(t);
            }
        }

        if (o.status.length>0) {
            // update hostCollectorStatus
            db.collection('hostCollectorStatus', function (err, collection) {
                collection.update({'hostId':host._id,'collector':'system'}, o, {'safe':false,'upsert':true}, function (err, objects) {
                });
            });
        }
    }
};

// a request to this collector from the server api, likely an interface wanting data
exports.serverApiRequest = function (db, hostId, hash, callback) {

    db.collection('systemCollector', function (err, collection) {
        collection.find({'hostId':new mongodb.ObjectID(hostId),'hash':hash}).toArray(function(err, docs) {
            callback(err, docs[0]);
        });
    });

}

// run on listener startup to ensure database indexes for this collector
exports.ensureIndex = function(db) {

    if (db) {
        console.log('ensuring');
        db.ensureIndex('systemCollector', {'hostId':1,'hash':1}, {'unique':true}, function(err, name) { if (err) { console.log(err) } });
    }

}
