var
  Q = require('q'),
  expect = require('expect.js'),
  domain = require('domain'),
  CC = require('../lib/chain-commander')(Q);

module.exports = {
  'Chain Commander': {
    'accepts both JSON and Javascript POJO': function(){
      var cc;

      cc = CC('{}');
      expect(cc.obj).to.eql([{}]);

      cc = CC({});
      expect(cc.obj).to.eql([{}]);
    },
    'exec call functions in the context object': function(done){
      var cc, obj;

      obj = {
        add: function(howmuch, value){
          return value + howmuch;
        },
        multiply: function(howmuch, value) {
          return value * howmuch;
        }
      };

      cc = CC({exec:[['add', 10],['multiply',10]]});

      cc.execute(10, obj).done(function(value){
        expect(value).to.be(200);
        done();
      });
    },
    'work with one conditional': function(done){
      var cc, obj;

      obj = {
        _alterMe: 0,
        alterMe: function(){
          this._alterMe = 'altered';
        },
        add: function(howmuch, value){
          return value + howmuch;
        },
        isntZero: function(value){
          return value !== 0;
        },
        isZero: function(value){
          return this._alterMe === 0;
        }
      };

      cc = CC([{
        if: {
          check: [
            ['isntZero']
          ],
          else: {
            exec: [
              ['add', 10]
            ]
          }
        }
      },{
        if: {
          check: [['isZero']],
          exec: [['alterMe']]
        }
      }]);

      cc
      .execute(0, obj)
      .done(function(value){
        expect(obj._alterMe).to.be('altered');
        expect(value).to.be(10);
        done();
      });
    },
    'deals with exec returning another promise': function(done){
      var cc, obj;

      obj = {
        returnPromise: function(value){
          var d = Q.defer();

          setTimeout(function(){
            d.resolve({'After timeout: ': value});
          }, 10);

          return d.promise;
        }
      };

      cc = CC({exec:[['returnPromise']]});

      cc.execute(0, obj).done(function(val){
        expect(val).to.eql({'After timeout: ': 0});
        done();
      });
    },
    'ifs work with promises': function(done){
      var cc, obj, cmds = [
        {
          if: {
            check: [['checkPromise']],
            exec:[['append','b']]
          }
        },
        {
          if: {
            check: [['checkPromise']],
            exec:[['append','c']]
          }
        }
      ];

      obj = {
        append: function(letter, value){
           return value + letter;
        },
        checkPromise: function(){
          var d = Q.defer();

          setTimeout(function(){
            d.resolve(true);
          }, 5);

          return d.promise;
        }
      };

      cc = CC(cmds);
      cc.execute('a', obj).done(function(value){
        expect(value).to.be('abc');
        done();
      });
    },
    'test the given example': function(done){
      var cc, cmds = [ // It uses arrays because it's the only way it can ensure order.
        {
          if: {
            // if (obj.check("first") and obj.check("second")) then
            check: [
              ['check', 'first'], // must match all
              ['check', 'second']
            ],
            // will be executed if obj.check("first") and obj.check("second") returns true
            exec      : [
              ['multiply', 10]
            ],
            // neither checks were present, make another check
            // else works as "if not"
            else      : {
              if  : {
                // else if (obj.check("third")) then
                check: [
                  ['check', 'third'] // obj.check("third")
                ],
                // will be executed only the obj.check("third") returns true
                exec      : [
                  ['alert', {msg: 'aww yeah'}] // alert({msg: "aww yeah"})
                ]
              },
              // this will be executed regardless of the above if
              exec: [
                ['add', 1],               // execute add(1)
                ['alert', {msg: 'else'}]  // execute alert({msg: "else"})
              ]
            }
          }
        },
        {
          // exec the alert function
          exec: [
            ['alert', {msg: 'Doodidoo'}]
          ]
        },
        {
          // exec the startTimer
          exec: [
            ['startTimer']
          ]
        },
        {
          // go on! new values, it will start executing after 1s from startTimer
          exec: [
            ['goOn']
          ]
        }
      ];

      var instance = {
        myvalue   : 3,
        check     : function (type, value){
          if (type === 'first') {
            return value > 0;
          } else if (type === 'second') {
            return value < 30;
          }
          return true;
        },
        getValue  : function (){
          return this.myvalue === 3;
        },
        multiply  : function (number, value){
          return value * number;
        },
        add       : function (number, value){
          return value + number;
        },
        log     : function (args, value){
          console.log(args.msg + ': ' + value);
          return value;
        },
        goOn      : function (value){
          if (!this.secondPass) {
            this.secondPass = true; // important so it won't create an endless loop
            return cc.execute(value, instance); // yes, you can execute the same CC and continue from there, start all over
          }
        },
        startTimer: function (args, value){
          var d = Q.defer();

          if (this.secondPass === false) {
            setTimeout(function (){
              d.resolve('Oops'); // this will be overwritten by the goOn "exec", that will continue from the previous value
            }, 1000);
          } else {
            d.reject();
          }

          return d.promise;
        }
      };

      cc = CC(cmds);
      cc.execute(10, instance).done(function (value){
        expect(value).to.equal(101);
        done();
      });

    },
    'use objects and change them while passing around': function(done) {
      var cc, nobj, context, cmds = [
        {
          exec:[['changeValue','value1']]
        },
        {
          exec:[['changeValue','value2']]
        },
        {
          exec:[['changeValue','value3']]
        }
      ];

      nobj = {
        value1: 1,
        value2: 2
      };

      context = {
        changeValue: function(name, value){
          if (value[name]) {
            value[name]++;
          } else {
            value[name] = null;
          }
        }
      };

      cc = CC(cmds);
      cc.execute(nobj, context).done(function(value){
        expect(value).to.be(nobj);
        expect(value).to.eql({value1: 2, value2: 3, value3: null});
        done();
      });
    },
    'deep nested ifs and elses': function(done) {
      var cc, context, cmds = [
        {
          if: {
            check: [['no']],
            else: {
              if: {
                check:[['no']],
                else: {
                  if: {
                    check:[['yes']],
                    exec:[['done']]
                  }
                }
              }
            }
          }
        }
      ];

      context = {
        no: function(){
          return false;
        },
        yes: function(){
          return true;
        },
        done: function(){
          return 'done';
        }
      };

      cc = CC(cmds);

      cc.execute(0, context).done(function(value){
        expect(value).to.be('done');
        done();
      });
    },
    'work on instances': function(done){
      var cc, cmds = [
        {
          if: {
            check:[
              ['check', 1]
            ],
            exec: [
              ['fromConstructor']
            ]
          }
        },
        {
          if: {
            check: [
              ['check', 2]
            ],
            else: {
              exec: [
                ['fromConstructor']
              ]
            }
          }
        },
        {
          if: {
            check: [
              ['check', 3]
            ],
            exec: [
              ['fromConstructor']
            ]
          }
        },
        {
          exec: [
            ['fromConstructor']
          ]
        }
      ];

      function Context(func){
        this.func = func;
        this.count = 0;
      }

      Context.prototype.check = function(type, value){
        this.count++;
        switch (type) {
          case 1:
            return true;
          case 2:
            return false;
          default:
            return true;
        }
      };

      Context.prototype.fromConstructor = function(value){
        this.count++;
        return this.func(value);
      };

      var context = new Context(function(value){ return ++value; });

      cc = CC(cmds);
      cc.execute(0, context).done(function(value){
        expect(value).to.be(4);
        expect(context.count).to.be(7);
        done();
      });
    },
    'forgiving on non existant checks and functions': function(done){
      var cc, obj = {thisOneDoes: function(plus, value){ return value + plus; }}, cmds = [
        {
          exec:[['doesntExist']]
        },
        {
          if: {
            check:[['doesntExistEither']],
            exec:[['nonExistant']]
          }
        },
        {
          exec:[['thisOneDoes',1]]
        }
      ];

      cc = CC(cmds);
      cc.execute(10, obj).done(function(value){
        expect(value).to.be(11);
        done();
      });
    },
    'unforgiving definition': function(done) {
      var ifDomain = domain.create(), execDomain = domain.create();
      var cc, obj = {}, cmds = [
        {
          if: {
            check:[['dontExist']]
          }
        },
        {
          exec:[['dontExists']]
        }
      ];

      cc = CC(cmds, {throws: true});

      ifDomain.on('error', function(err){
        expect(err.message).to.be('"if" function "dontExist" doesnt exists');
        cc = CC(cmds.pop(), {throws: true});

        execDomain.on('error', function(err){
          expect(err.message).to.be('"exec" function "dontExists" doesnt exists');
          done();
        });

        execDomain.run(function(){
          cc.execute(0, obj).done(function(){});
        });
      });

      ifDomain.run(function(){
        cc.execute(0, obj).done(function(){});
      });
    }
  }
};