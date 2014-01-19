(function (root, definition){

  if (typeof exports === 'object') {
    /* CommonJS/Node.js */
    module.exports = definition;

  } else if (typeof root.define === 'function' && root.define.amd) {
    /* RequireJS */
    root.define(['Q'], definition);
  } else {
    /* <script> */
    if (typeof root.Q === 'undefined') {
      throw new Error('Q library is missing');
    }
    root.ChainCommander = definition(root.Q);
  }

})(this, function (Q){
  'use strict';

  function convert(obj){
    if (typeof obj === 'string') {
      obj = JSON.parse(obj);
    }

    /* Normalize it to always create an array from the obj */
    return Array.prototype.concat.call(obj);
  }

  function parser(obj, initial, context){
    /*jshint validthis:true */
    var _top, _inner, i, j, ilen, jlen, self = this;

    function log() {
      if (self.debug === true) {
        console.log.apply(console, Array.prototype.slice.call(arguments));
      }
    }

    obj = convert(obj);

    initial = Q(initial);

    log('initial', initial.inspect());

    function exec(parsing){
      log('exec out');
      /* create a promise from any return value from the "exec" functions, including other promises */
      return function execPromise(currentValue) {
        var d = Q.defer();
        log('exec in');

        /* we need to separate from the main promise chain, since, we don't want it to fail, we need it
          to keep going regardless of rejected, since its up to the user on how to deal with the value */

        Q.fcall(function (){
          log('exec fcall', parsing);
          /* Does the exec function return a value or a promise? Doesn't matter */
          /* Pass in the current value as the last parameter, always. */
          if (self.throws === true && typeof context[parsing[0]] !== 'function') {
            throw new Error('"exec" function "' + parsing[0] + '" doesnt exists');
          }
          return context[parsing[0]].apply(context, parsing.slice(1).concat(currentValue));
        })
        .fail(function (err){
          log('exec fail');
          /* The function threw an exception, we need to continue with the unchanged value */
          if (self.throws === true) {
            d.reject(err);
          } else {
            d.resolve(currentValue);
          }
        })
        .done(function(val){
          log('exec done', val);

          if (val === void 0) {
            /* resolve with the current value, the function had no "return" */
            d.resolve(currentValue);
          } else {
            /* everything went well, resolve with the new value */
            d.resolve(val);
          }
        });

        return d.promise;
      };
    }

    function ifblock(parsing){
      log('if out');
      /* return a promise from an ifblock, and add it do the promise chain */
      return function ifblockPromise(currentValue){
        log('if in', currentValue);
        var i, len, d = Q.defer();

        if (typeof parsing['check'] !== 'undefined') {
          /* side promise */
          var conditions = Q();

          var conditional = function(condition){
            log('conditional out');
            return function conditionalPromise(bool){
              log('conditional in', bool);
              /* starts at undefined, that if it doesnt become true, it will be typecasted to boolean false */
              var d = Q.defer();

              if (bool === false) {
                /* previous if check failed, just stop it before calling the other function */
                d.resolve(false);
              } else {
                Q.fcall(function(){
                  /* the function return a future value, regardless if it's a promise or a primitive value */
                  log('conditional fcall', condition[0]);
                  if (self.throws === true && typeof context[condition[0]] !== 'function') {
                    throw new Error('"if" function "' + condition[0] + '" doesnt exists');
                  }
                  return context[condition[0]].apply(context, condition.slice(1).concat(currentValue));
                })
                .fail(function(err){
                  /* in case the "if" function were rejected, resolve to false */
                  log('conditional fail');
                  if (self.throws === true) {
                    d.reject(err);
                  } else {
                    d.resolve(false);
                  }
                })
                .done(function(val){
                  /* typecast the result and convert to a boolean */
                  log('conditional done', !!val);
                  d.resolve(!!val);
                });
              }

              return d.promise;
            };
          };

          var conditionalelse = function (_else){
            log('conditionalelse out');
            return function conditionalelsePromise(currentValue){
              log('conditionalelse in');
              var d = Q.defer();

              /* try to return a future "else" value, since parser always return a new promise */
              log('conditionalelse fcall', _else);

              parser.call(self, _else, currentValue, context)
              .fail(function(){
                /* the last parser threw an error, keep going with the current unchanged value */
                log('conditionalelse fcall');
                d.resolve(currentValue);
              })
              .done(function(val){
                /* only resolve with the new value if it isn't undefined (that means the value had no "return" value */
                log('conditionalelse done', val);

                if (val === void 0) {
                  d.resolve(currentValue);
                } else {
                  d.resolve(val);
                }
              });

              return d.promise;
            };
          };

          for (i = 0, len = parsing['check'].length; i < len; i++) {
            conditions = conditions.then(conditional(parsing['check'][i]));
          }

          conditions.done(function(val){
            log('checks', val);
            /* side promise chain, true or false */
            var inpromise = Q(currentValue);

            /* we should either check if the "if" was successiful, if so, execute */
            if (val === true) {
              for (i = 0, len = parsing['exec'].length; i < len; i++) {
                inpromise = inpromise.then(exec(parsing['exec'][i]));
              }
            } else {
              if (typeof parsing['else'] !== 'undefined') {
                inpromise = inpromise.then(conditionalelse(parsing['else']));
              }
            }

            d.resolve(inpromise);
          });
        } else {
          d.resolve(currentValue);
        }

        return d.promise;
      };
    }

    for (i = 0, ilen = obj.length; i < ilen; i++) {
      _top = obj[i];
      if (typeof _top['if'] !== 'undefined') {
        _inner = _top['if'];
        initial = initial.then(ifblock(_inner));
      }
      if (typeof _top['exec'] !== 'undefined') {
        for (j = 0, jlen = _top['exec'].length; j < jlen; j++) {
          _inner = _top['exec'][j];
          initial = initial.then(exec(_inner));
        }
      }
    }

    return initial;
  }

  function ChainCommander(obj, opts){
    if (!(this instanceof ChainCommander)) {
      return new ChainCommander(obj, opts);
    }

    opts = opts || {};

    this.debug = opts.debug !== undefined ? opts.debug : false;
    this.throws = opts.throws !== undefined ? opts.throws : false;

    this.obj = convert(obj);
  }

  ChainCommander.prototype.execute = function(initial, context){
    return parser.call(this, this.obj, Q(initial), context);
  };

  return ChainCommander;
});
