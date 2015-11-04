(function(window, document, hp) {
	var URL_UPLOAD = '__URL_REPLACE_MARKER__';

	function Uploader() {
		this.fileList = null;

		this.onProgress = null; //Transmitting data. function(event) event: loaded, total
		this.onLoadend = null; //completed (either in success or failure).
		this.onAbort = null; //has been aborted.
		this.onError = null; //failed.
		this.onTimeout = null; //timeout before the request completed.
		this.onLoad = null; //successfully completed.
	}

	/*
	 * option: {
	 *	multiple: 	boolean -- user can upload multiple files, default to true
	 *	imageOnly: 	boolean -- upload images only, default to false
	 * }
	 * callback: function/undefined called after use selectd files. If left empty, then call open automatically after files seleced.
	 */
	Uploader.prototype.open = function(option, callback) {
		var me = this,
			form, inputElement;

		function handleFiles() {
			me.fileList = this.files;
			if(typeof callback === 'function') {
				callback.call(me);
			} else if(callback === undefined) {
				me.send.call(me);
			}
		}

		if(typeof option === 'function') {
			callback = option;
			option = undefined;
		}

		option = option || {multiple: true, imageOnly: false};

		if(!document.getElementById('handpage-uploader')) {
			form = document.createElement('form');
			form.setAttribute('enctype', 'multipart/form-data');
			form.setAttribute('id', 'handpage-uploader');
			form.setAttribute('style', 'display: none');
			form.innerHTML = '<input type="file" name="file" value=""' + (option.multiple ? ' multiple ': '') + (option.imageOnly ? ' accept="image/*" ' : '') + ' />';
			document.getElementsByTagName("body")[0].appendChild(form);
		}

		inputElement = document.querySelector('#handpage-uploader input');
		if(!inputElement._handpage_uploader_onChangeHandlerAdded) {
			inputElement.addEventListener("change", handleFiles, false);
			inputElement._handpage_uploader_onChangeHandlerAdded = true;
		}

		inputElement.click();
	};

	Uploader.prototype.send = function() {
		var formData = new FormData(),
			xhr = new XMLHttpRequest();

		xhr.open("POST", URL_UPLOAD, true);
		if(this.onProgress) xhr.upload.addEventListener("progress", this.onProgress.bind(this), false);
		if(this.onLoadend) xhr.upload.addEventListener("loadend", this.onLoadend.bind(this), false);
		if(this.onAbort) xhr.upload.addEventListener("abort", this.onAbort.bind(this), false);
		if(this.onError) xhr.upload.addEventListener("error", this.onError.bind(this), false);
		if(this.onTimeout) xhr.upload.addEventListener("timeout", this.onTimeout.bind(this), false);
		if(this.onLoad) xhr.upload.addEventListener("load", this.onLoad.bind(this), false);

		for(var i = 0; i < this.fileList.length; i++) {
			formData.append('file', this.fileList[i], this.fileList[i].name);
		}

		xhr.send(formData);
	}

	handpage.uploader = new Uploader();

})(window, document, handpage);
