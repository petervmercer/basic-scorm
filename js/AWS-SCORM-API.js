//
// A lot of this code is open source and taken from SCORM 1.2 API Implementation from Moodle
//

(function (apiName, window, awsGatewayApi, $, config) {
  'use strict';

  var _awsGatewayApi = awsGatewayApi;
  var _requiredParameters = {};
  var _uuid = "";
  var _awsStudentUuid = 'awsstudentuuid';
  var _initialSendSwitch = {send: 0, complete: 0, attempts: 0}
  var _awsGatewayPaths = {
    initialise: '/init',
    student: '/student',
    activity: '/activity'
  };

  var _cmiUtils = {
    cmiString255: '^[\\u0000-\\uFFFF]{0,255}$',
    cmiString4096: '^[\\u0000-\\uFFFF]{0,4096}$',
    cmiStatus: '^passed$|^completed$|^failed$|^incomplete$|^browsed$',
    cmiStatus2: '^passed$|^completed$|^failed$|^incomplete$|^browsed$|^not attempted$',
    cmiResult: '^correct$|^wrong$|^unanticipated$|^neutral$|^([0-9]{0,3})?(\.[0-9]*)?$',
    cmiEntry: '^ab-initio$|^resume$',
    cmiDecimal: '^-?([0-9]{0,3})(\.[0-9]*)?$',
    cmiRangeAll: 'ALL',
    cmiRangePercent: '0#100',
    cmiRangeAudio: '-1#100',
    cmiRangeSpeed: '-100#100',
    cmiRangeWeight: '-100#100',
    cmiRangeText: '-1#1',
    cmiExit: '^time-out$|^suspend$|^logout$|^$',
    cmiTimeSpan: '^([0-9]{2,4}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,2})?$',
    cmiInteger: '^\\d+$',
    cmiStringInteger: '^-?([0-9]+)$',
    cmiIndex: '[._](\\d+).',
    cmiIdentifier: '^[\\u0021-\\u007E]{0,255}$',

  };

  var _awsLMSModel = {
    'LmsLoaded': false,
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
    'Comments': {
      'main': '',
      'CommentsFromLms': ''
    },
    'CmiObjectives': {
      'cmi_count': '0',
    },
    'CmiStudentPreferences': {
      'audio': '0',
      'language': 'en',
      'speed': '0',
      'text': '0'
    },
    'CmiInteractions': {
      'cmi_count': '0'
    }


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
    'cmi.core.student_id': {type: 'r', format: _cmiUtils.cmiString255, location: 'AWS'},
    'cmi.core.student_name': {type: 'r', format: _cmiUtils.cmiString255, location: 'AWS'},
    'cmi.core.lesson_location': {type: 'rw', format: _cmiUtils.cmiString255, location: 'AWS'},
    'cmi.core.credit': {type: 'd', ret: 'credit'},
    'cmi.core.lesson_status': {type: 'rw', format: _cmiUtils.cmiStatus, location: 'AWS'},
    'cmi.core.entry': {type: 'r', format: _cmiUtils.cmiEntry},
    'cmi.core.score_children': {type: 'd', ret: 'raw,min,max'},
    'cmi.core.score.raw': {type: 'rw', format: _cmiUtils.cmiDecimal, range: _cmiUtils.cmiRangePercent},
    'cmi.core.score.max': {type: 'rw', format: _cmiUtils.cmiDecimal, range: _cmiUtils.cmiRangePercent},
    'cmi.core.score.min': {type: 'rw', format: _cmiUtils.cmiDecimal, range: _cmiUtils.cmiRangePercent},
    'cmi.core.total_time': {type: 'r', format: _cmiUtils.cmiTimeSpan},
    'cmi.core.lesson_mode': {type: 'd', ret: 'normal'},
    'cmi.core.exit': {type: 'w', format: _cmiUtils.cmiExit},
    'cmi.core.session_time': {type: 'w', format: _cmiUtils.cmiTimeSpan},
    'cmi.suspend_data': {type: 'rw', format: _cmiUtils.cmiString4096},
    'cmi.launch_data': {type: 'd', ret: config.launchData},
    'cmi.comments': {type: 'rw', format: _cmiUtils.cmiString4096},
    'cmi.comments_from_lms': {type: 'rw', format: _cmiUtils.cmiString4096},
    'cmi.objectives._children': {type: 'd', ret: 'id,score,status'},
    'cmi.objectives._count': {type: 'r', format: _cmiUtils.cmiInteger, range: _cmiUtils.cmiRangeAll},
    'cmi.objectives.n.id': {type: 'rw', format: _cmiUtils.cmiIdentifier, pattern: _cmiUtils.cmiIndex},
    'cmi.objectives.n.score._children': {type: 'r', pattern: _cmiUtils.cmiIndex},
    'cmi.objectives.n.score.raw': {
      type: 'rw',
      'pattern': CMIIndex,
      'format': _cmiUtils.cmiDecimal,
      'range': _cmiUtils.cmiRangePercent
    },
    'cmi.objectives.n.score.min': {
      type: 'rw',
      'pattern': CMIIndex,
      'format': _cmiUtils.cmiDecimal,
      'range': _cmiUtils.cmiRangePercent
    },
    'cmi.objectives.n.score.max': {
      type: 'rw',
      'pattern': CMIIndex,
      'format': _cmiUtils.cmiDecimal,
      'range': _cmiUtils.cmiRangePercent
    },
    'cmi.objectives.n.status': {type: 'rw', 'pattern': _cmiUtils.cmiIndex, 'format': _cmiUtils.cmiStatus2},
    'cmi.student_data._children': {type: 'd', ret: 'mastery_score,max_time_allowed,time_limit_action'},
    'cmi.student_data.mastery_score': {type: 'd', ret: config.masteryScore},
    'cmi.student_data.max_time_allowed': {type: 'd', ret: config.maxTimeAllowed},
    'cmi.student_data.time_limit_action': {type: 'd', ret: config.timeLimitAction},
    'cmi.student_preference._children': {type: 'd', ret: 'audio,language,speed,text'},
    'cmi.student_preference.audio': {type: 'rw', format: _cmiUtils.cmiStringInteger, range: _cmiUtils.cmiRangeAudio},
    'cmi.student_preference.language': {type: 'rw', format: _cmiUtils.cmiString255},
    'cmi.student_preference.speed': {type: 'rw', format: _cmiUtils.cmiStringInteger, range: _cmiUtils.cmiRangeSpeed},
    'cmi.student_preference.text': {type: 'rw', format: _cmiUtils.cmiStringInteger, range: _cmiUtils.cmiRangeText},
    'cmi.interactions._children': {
      type: 'd',
      ret: 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency'
    },
    'cmi.interactions._count': {type: 'r', format: _cmiUtils.cmiStringInteger, range: _cmiUtils.cmiRangeAll},
    'cmi.interactions.n.id': {type: 'w', format: _cmiUtils.cmiIdentifier, pattern: _cmiUtils.cmiIndex},
    'cmi.interactions.n.objectives._count': {type: 'r', format: _cmiUtils.cmiIdentifier, pattern: _cmiUtils.cmiIndex},
    'cmi.interactions.n.objectives.n.id': {type: 'w', format: _cmiUtils.cmiIdentifier, pattern: _cmiUtils.cmiIndex},
    'cmi.interactions.n.time': {type: 'w', format: _cmiUtils.cmiIdentifier, pattern: _cmiUtils.cmiIndex},
    'cmi.interactions.n.type': {type: 'w', format: _cmiUtils.cmiIdentifier, pattern: _cmiUtils.cmiIndex},
    'cmi.interactions.n.correct_responses._count': {
      type: 'r',
      format: _cmiUtils.cmiIdentifier,
      pattern: _cmiUtils.cmiIndex
    },
    'cmi.interactions.n.correct_responses.n.pattern': {
      type: 'w',
      pattern: _cmiUtils.cmiIndex,
      format: _cmiUtils.cmiString255
    },
    'cmi.interactions.n.weighting': {
      type: 'w',
      pattern: _cmiUtils.cmiIndex,
      format: _cmiUtils.cmiDecimal,
      range: _cmiUtils.cmiRangeWeight
    },
    'cmi.interactions.n.student_response': {type: 'w', pattern: _cmiUtils.cmiIndex, format: _cmiUtils.cmiString255},
    'cmi.interactions.n.result': {type: 'w', pattern: _cmiUtils.cmiIndex, format: _cmiUtils.cmiResult},
    'cmi.interactions.n.latency': {type: 'w', pattern: _cmiUtils.cmiIndex, format: _cmiUtils.cmiTimeSpan}
  };

  var _cleanSecondary = function (str) {
    if (str.indexOf('_', 0) === 0) {
      str = 'cmi_' + result[1].replace('_', '');
    }
    str = str.replace('.', '_');
    return str;
  };

  var _parseCMI = function (cmiStr) {
    // all cmi.core entries
    var result = cmiStr.split('cmi.core.');
    var secondary = "";
    if (result > 1) {
      secondary = _cleanSecondary(result[1]);
      return ['CmiCore', seconday]
    }
    // Suspend data
    result = cmiStr.split('cmi.suspend_data');
    if (result === 1) {
      return ['SuspendData'];
    }
    // Launch date
    result = cmiStr.split('cmi.launch_data');
    if (result === 1) {
      return ['LaunchData'];
    }
    // Comments
    result = cmiStr.split('cmi.comments');
    if (result === 1) {
      return ['Comments', 'main'];
    }
    // Comments from LMS
    result = cmiStr.split('cmi.comments_from_lms');
    if (result === 1) {
      return ['Comments', 'CommentsFromLms'];
    }
    // cmi.objectives
    result = cmiStr.split('cmi.objectives.');
    if (result > 1) {
      secondary = _cleanSecondary(result[1]);
      return ['CmiObjectives', seconday];
    }
    // cmi student preference
    result = cmiStr.split('cmi.student_preference.');
    if (result > 1) {
      secondary = _cleanSecondary(result[1]);
      return ['StudentPreference', secondary];
    }
    // cmi student interactions
    result = cmiStr.split('cmi.interactions.');
    if (result > 1) {
      secondary = _cleanSecondary(result[1]);
      return ['CmiInteractions', secondary];
    }

    return [];
  };


  var _initialised = false;

  var _getParameter = function (paramName) {
    var result = {},
      tmp = [];
    var items = location.search.substr(1).split("&");
    for (var index = 0; index < items.length; index++) {
      tmp = items[index].split("=");
      if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    }
    return result;
  };

  var _getParameters = function () {
    var result = {},
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

  var _getSetExternalData = function (url, apiKey, method, params, completeHandler, errorHandler) {
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

  var _lmsInitialise = function () {
    _getExternalLMS();
    return _initialised;

  };

  var _getExternalLMS = function () {
    if (!_initialised && _initialSendSwitch.send === _initialSendSwitch.complete && _initialSendSwitch.attempts < 20) {
      // Need to pull the params from the page frame and then check on AWS whether this person can have access
      var params = _createExternalParams();
      _initialSendSwitch.send = 1;
      // Need to call AWS to see if the service is available
      _getSetExternalData(_awsGatewayApi + _awsGatewayPaths.student, _requiredParameters.apikey, 'GET', params, function (data) {
        _initialised = true;
        // add uuid and save parameters etc locally.
        _uuid = data.StudentActivityOrgPK;
        if (_checkLocalStorage()) {
          localStorage.setItem(_awsStudentUuid, _uuid);
        }

        _initialSendSwitch.send = 0;
        _initialSendSwitch.attempts++;


      }, function (jqXHR, textStatus, errorThrown) {
        _initialised = false;
        _initialSendSwitch.send = 0;
        _initialSendSwitch.attempts++;
      });
    }
  };

  var _setExternalLMS = function(awsDbModel, cmiValue) {
    if(_initialised) {
      var params = _createExternalParams();
      params.cmikey = JSON.stringify(awsDbModel);
      params.cmiValue = cmiValue;
      _getSetExternalData(_awsGatewayApi + _awsGatewayPaths.student, _requiredParameters.apikey, 'PUT', params, function (data) {
        // Done correctly
        _initialSendSwitch.attempts = 0;

      }, function (jqXHR, textStatus, errorThrown) {
        if (_initialSendSwitch.attempts < 20) {
          _initialSendSwitch.attempts++;
          _setExternalLMS(awsDbModel, cmiValue);
        }

      });
    }
  };

  var _getLocalLMS = function (cmiString) {
    if (_awsLMSModel.LmsLoaded) {
      var checkStore = _parseCMI(cmivalue);

      if (checkStore.length === 2) {
        if (_awsLMSModel[checkStore[0]][checkStore[1]] !== '') {
          return _awsLMSModel[checkStore[0]][checkStore[1]];
        }
      }

    } else {
      // get local store
      if (_checkLocalStorage) {
        // Code for localStorage/sessionStorage.
        _awsLMSModel = JSON.parse(localStorage.locallms);
      } else {
        // Sorry! No Web Storage support.
        if (_initialised) {
          _initialised = true;
          _lmsInitialise();
        }
      }


    }

  };


  var _lmsGetValue = function (cmikey) {
    var checkStore = [];
    if (_initialised) {
      if (_cmiReturns[cmikey].type === 'd') {
        return _cmiReturns.ret;
      }
      if (_cmiReturns[cmikey].type === 'r') {
        // check local store.
        checkStore = _parseCMI(cmikey);
        if (checkStore.length === 1) {
          if (_awsLMSModel[checkStore[0]] !== '') {
            return _awsLMSModel[checkStore[0]][checkStore[1]];
          }
        }
        if (checkStore.length === 2) {
          if (_awsLMSModel[checkStore[0]][checkStore[1]] !== '') {
            return _awsLMSModel[checkStore[0]][checkStore[1]];
          }
        }
      }
    }
    return false;
  };

  var _lmsSetValue = function (cmikey, cmivalue) {
    //What is the cmivalue is dodgey
    // Save it locally
    var updateStore = [], match = false;
    // if it is initialised
    if (_initialised) {
      updateStore = _parseCMI(cmikey);
      if (checkStore.length === 1) {
        var expression1 = new RegExp(_cmiReturns[cmikey].format);
        match = cmivalue.match(expression1);
        if (match) {
          _awsLMSModel[updateStore[0]] = cmivalue;
          if(_checkLocalStorage()) {
            localStorage.setItem('locallms', JSON.stringify(_awsLMSModel));
          }
         // Go to AWS


          return true;
        } else {
          return false;
        }
      }
      if (checkStore.length === 2) {
        var expression2 = new RegExp(_cmiReturns[cmikey].format);
        match = cmivalue.match(expression2);
        if (match) {
          _awsLMSModel[updateStore[0]] = cmivalue;
          return true;
        } else {
          return false;
        }
      }
    }

    // Problem - what if person refreshes their browser

  }


  return window[apiName] = {
    LMSInitialize: _lmsInitialise,
    LMSGetValue: _lmsGetValue
  };


})('API', window, 'https://endpoint', $, activityConfig);
