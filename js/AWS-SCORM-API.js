//
// A lot of this code is open source and taken from SCORM 1.2 API Implementation from Moodle
//

(function (apiName, window, awsGatewayApi, $) {
  'use strict';

  var _awsGatewayApi = awsGatewayApi;
  var _requiredParameters = {};
  var _uuid = "";
  var _awsStudentUuid = 'awsstudentuuid';
  var _awsGatewayPaths = {
    initialise: '/init',
    student: '/student',
    activity: '/activity'
  };

  var _cmiUtils = {
    cmiString255: '^[\u0000-\uFFFF]{0,255}$',
    cmiString4096: '^[\u0000-\uFFFF]{0,4096}$',
    cmiStatus: '^passed$|^completed$|^failed$|^incomplete$|^browsed$',
    cmiEntry: '^ab-initio$|^resume$',
    cmiDecimal: '^-?([0-9]{0,3})(\.[0-9]*)?$',
    cmiRange: '0#100',
    cmiExit: '^time-out$|^suspend$|^logout$|^$',
    cmiTimeSpan: '^([0-9]{2,4}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,2})?$'
  };

  var _awsLMSModel = {
    'CmiCore': {
      'student_id': '',
      'student_name': '',
      'lesson_location': '',
      'status': 'incomplete',
      'entry': 'ab-initio',
      'score_raw': 0,
      'score_max': 0,
      'score_min': 0,
      'total_time': 0,
      'exit': '',
      'session_time': '00:00:00'
    },
    'SuspendData': '',

  };

  // d is default return only r is read, w is write and rw is read write
  // This code is a slightly modified copy of an opensource SCORM1.2 implementation
  var _cmiReturns = {
    'cmi._children': {
      type: 'd',
      ret: 'core,suspend_data,launch_data,comments,objectives,student_data,student_preference,interactions'
    },
    'cmi._version': {type: 'd', ret: '3.4'},
    'cmi.core._children': {
      type: 'd',
      ret: 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time'
    },
    'cmi.core.student_id': {type: 'r', format: _cmiUtils.cmiString255},
    'cmi.core.student_name': {type: 'r', format: _cmiUtils.cmiString255},
    'cmi.core.lesson_location': {type: 'rw', format: _cmiUtils.cmiString255},
    'cmi.core.credit': {type: 'd', ret: 'credit'},
    'cmi.core.lesson_status': {type: 'rw', format: _cmiUtils.cmiStatus},
    'cmi.core.entry': {type: 'r' },
    'cmi.core.score_children': {type: 'd', ret: 'raw,min,max'},
    'cmi.core.score.raw': {type: 'rw', format: _cmiUtils.cmiDecimal, range: _cmiUtils.cmiRange},
    'cmi.core.score.max': {type: 'rw', format: _cmiUtils.cmiDecimal, range: _cmiUtils.cmiRange},
    'cmi.core.score.min': {type: 'rw', format: _cmiUtils.cmiDecimal, range: _cmiUtils.cmiRange},
    'cmi.core.total_time': {type: 'r'},
    'cmi.core.lesson_mode': {type: 'd'},
    'cmi.core.exit': {type: 'w', format: _cmiUtils.cmiExit},
    'cmi.core.session_time': {type: 'w', format: _cmiUtils.cmiTimeSpan},
    'cmi.suspend_data': {type: 'rw', format: _cmiUtils.cmiString4096},
    'cmi.launch_data': {type: 'r'}

  };

  var _initialised = false;

  var _getParameter = function (paramName) {
    var result = null,
      tmp = [];
    var items = location.search.substr(1).split("&");
    for (var index = 0; index < items.length; index++) {
      tmp = items[index].split("=");
      if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    }
    return result;
  };

  var _getParameters = function () {
    var result = null,
      tmp = [];
    var items = location.search.substr(1).split("&");
    for (var index = 0; index < items.length; index++) {
      tmp = items[index].split("=");
      result[tmp[0]] = decodeURIComponent(tmp[1]);
    }
    return result;
  };

  var _checkLocalStorage = function () {
    return typeof (Storage) !== 'undefined';
  };

  var _getExternalData = function (url, apiKey, method, params, completeHandler, errorHandler) {
    $.ajax({
      type: method,
      url: url,
      beforeSend: function (jqXHR) {
        jqXHR.setRequestHeader('x-api-key', apiKey);
      },
      dataType: "json",
      cache: false,
      data: params,
      error: function (jqXHR, textStatus, errorThrown) {
        errorHandler(jqXHR, textStatus, errorThrown);
      },
      timeout: 40000,
      success: function (data) {
        completeHandler(data);
      }
    });
  };


  /**
   * @name _extend
   * @kind function
   *
   * @description
   * Extends an object with another objects keys and value pairs.  Sending in ({},object) will
   * preserve the original object, a number of objects can be added
   * keys will overwrite duplicate keys and so is not a deep copy
   *
   * @param {Object} _obj object.
   * @param {...Object} adding object(s).
   * @returns {Object} Reference to _obj.
   */
  var _extend = function (_obj) {
    for (var i = 1, ii = arguments.length; i < ii; i++) {
      var obj = arguments[i];
      if (obj) {
        for (var key in obj) {
          _obj[key] = obj[key];
        }
      }
    }
    return _obj;
  };

  /**
   * @name _createExternalParams(objs)
   * @kind function
   *
   * @description
   * Updates the config and the LMS
   *
   * @param objs Object extending params
   * @return Object params
   *
   */
  var _createExternalParams = function (objs) {
    if (typeof _requiredParameters.studentname === 'undefined') {
      _requiredParameters = _getParameters();
    }
    var params = {};
    params.studentname = _requiredParameters.studentname;
    params.organisation = _requiredParameters.organisation;
    params.activity = _requiredParameters.activity;

    if (arguments.length === 1) _extend(params, objs);
    return params;
  };

  var _lmsInitialise = function (param) {
    // Need to pull the params from the page frame and then check on AWS whether this person can have access
    var params = _createExternalParams();

    // Need to call AWS to see if the service is available
    _getExternalData(_awsGatewayApi + _awsGatewayPaths.student, _requiredParameters.apiKey, 'GET', params, function (data) {
      _initialised = true;
      // add uuid and save parameters etc locally.
      _uuid = data.StudentActivityOrgPK;
      if (_checkLocalStorage()) {
        localStorage.setItem(_awsStudentUuid, _uuid);
      }
      return _initialised;

    }, function (jqXHR, textStatus, errorThrown) {
      _initialised = false;

      return _initialised;
    })

  };


  var _lmsGetValue = function () {
    if (_initialised) {

    }
  };


  return window[apiName] = {
    LMSInitialize: _lmsInitialise,
    LMSGetValue: _lmsGetValue
  };


})('API', window, 'https://endpoint', $);
