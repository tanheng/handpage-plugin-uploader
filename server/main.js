var PLUGIN_PREFIX = 'handpage-plugin-',
	REPLACE_MARKER = '__URL_REPLACE_MARKER__',
	HASH_DIR_PART_SIZE = 8,
    HASH_DIR_NUM_PARTS = 32 / HASH_DIR_PART_SIZE,
	multer  = require('multer'),
	storage = multer.memoryStorage(),
	upload = multer({ storage: storage }),
	fs = require('fs'),
    path = require('path'),
	crypto = require('crypto');

/*
 * make dir asynchronous and recursively
 *      p string path
 *      mode string permission mask. default to  0o777
 */
function mkdirra(p, mode, f, made) {
    if (typeof mode === 'function' || mode === undefined) {
        f = mode;
        mode =  0o777 & (~process.umask());
    }
    if (!made) made = null;

    var cb = f || function () {};
    if (typeof mode === 'string') mode = parseInt(mode, 8);
    p = path.resolve(p);

    fs.mkdir(p, mode, function (er) {
        if (!er) {
            made = made || p;
            return cb(null, made);
        }
        switch (er.code) {
            case 'ENOENT':
                mkdirra(path.dirname(p), mode, function (er, made) {
                    if (er) cb(er, made);
                    else mkdirra(p, mode, cb, made);
                });
                break;

            // In the case of any other error, just see if there's a dir
            // there already.  If so, then hooray!  If not, then something
            // is borked.
            default:
                fs.stat(p, function (er2, stat) {
                    // if the stat fails, then that's super weird.
                    // let the original error be the failure reason.
                    if (er2 || !stat.isDirectory()) cb(er, made);
                    else cb(null, made);
                });
                break;
        }
    });
}

function findConfig(pluginsConfig) {
	for(var i = 0; i < pluginsConfig.length; i++) {
		if(pluginsConfig[i].name === 'uploader') return pluginsConfig[i].config;
	}
	return null;
}

function copyClientjs(rootdir, route) {
	try {
        fs.accessSync(path.join(rootdir, 'asset', 'uploader.js'));
    } catch(e) {
		var jsContent = fs.readFileSync(path.join(rootdir, 'node_modules', PLUGIN_PREFIX + 'uploader', 'client', 'uploader.js'), 'utf8');
		fs.writeFileSync(path.join(rootdir, 'asset', 'handpage-plugin-uploader.js'), jsContent.replace(REPLACE_MARKER, route), {encoding: 'utf8'});
    }
}

function normalizePath(p) {
	if(p[0] === '/' || p[0] === '\\' ) p = p.substr(1);
	if(p[p.length - 1] === '/' || p[p.length - 1] === '\\') p = p.substr(0, p.length - 1);
	if(path.sep !== '/') p = p.replace('/', path.sep);
	return p;
}

function createFolder(rootdir, folder, cb) {
	var folder = normalizePath(folder);

	fs.stat(path.join(rootdir, folder), function(err, stat) {
		if(err) {
			mkdirra(path.join(rootdir, folder), cb);
		} else if(!stat.isDirectory()) {
			cb(path.join(rootdir, folder) + ' is NOT a directory!');
		} else {
			cb();
		}
	});
}

function md5topath(md5) {
	var str = '';

    for (var i = 0; i < HASH_DIR_NUM_PARTS; i++){
        str += md5.substr(i * HASH_DIR_PART_SIZE, HASH_DIR_PART_SIZE) + path.sep;
    }
    str += md5.substr(HASH_DIR_PART_SIZE * HASH_DIR_NUM_PARTS);
    return str;
}

function saveFiles(files, rootdir, res) {
	var pendings = [],
		map = [];

	function save() {
		var file, p, md5, hash;

		if(pendings.length === 0) {
			res.json(map);
		} else {
			file = pendings.shift();
			buffer = file.buffer;
			hash = crypto.createHash('md5');
			hash.update(Buffer.concat([file.buffer, new Buffer(file.filename)]));
			md5 = hash.digest('hex');
			p = path.join(rootdir, md5topath(md5));
			map.push({md5: md5, filename: file.filename});
			mkdirra(p, function(err) {
				if(err) {
					res.status(500).send(err);
				} else {
					fs.writeFile(path.join(p, file.filename), file.buffer, {mode: 0o644}, function(err){
						if(err) {
							res.status(500).send(err);
						} else {
							save();
						}
					});
				}
			});
		}
	}

	for(var i = 0; i < files.length; i++) {
		pendings.push({buffer: files[i].buffer, filename: files[i].originalname});
	}
	save();
}

function getFilePath(md5, callback) {
	var rf = this.root;

	if(typeof md5 !== 'string' || md5.length !== 32) return callback();
	var p = path.join(rf, md5topath(md5));
	fs.readdir(p, function(err, files){
		if(err|| files.length < 1) return callback();
		return callback(path.join(p, files[0]));
	});
}

/*
 * config:
 *	route: 	string default to '/upload'
 *  folder:	string default to 'var/upload'
 */
exports.onBuild = function(env, next) {
	var config = findConfig(env.config.plugins) || {};

	env.injection.headers = ['<script src="handpage-plugin-uploader.js"></script>'];
	copyClientjs(env.cwd, config.route || '/upload');
	createFolder(env.cwd, config.folder || 'var/upload', next);
}

exports.onInit = function(handpage) {
	var config = findConfig(handpage.config.plugins) || {};
	config.route = config.route || '/upload';
	config.folder = normalizePath(config.folder || 'var/upload');

	handpage.uploader = {getFilePath: getFilePath.bind({root: path.join(handpage.rootdir, config.folder)})};

	handpage.app.post(config.route, upload.array('file'), function(req, res) {
		saveFiles(req.files, path.join(handpage.rootdir, config.folder), res);
	});
}
