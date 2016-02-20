describe('Chain Commander', function (){

  it('accepts both JSON and Javascript POJO', function (){
    var cc;

    cc = ChainCommander('{}');
    expect(cc.defs).to.deep.equal([
      {}
    ]);

    cc = ChainCommander({});
    expect(cc.defs).to.deep.equal([
      {}
    ]);
  });

  it('if without member check is forgiving', function (){
    return ChainCommander([
      {if: {
        exec: [
          ['done']
        ]
      }}
    ]).execute('ok', {}).then(function (value){
      expect(value).to.equal('ok');

      return null;
    });
  });

  it('exec call functions in the context object', function (){
    var cc, obj;

    obj = {
      add     : function (howmuch, value){
        return value + howmuch;
      },
      multiply: function (howmuch, value){
        return value * howmuch;
      }
    };

    cc = ChainCommander({exec: [
      ['add', 10],
      ['multiply', 10]
    ]});

    return cc.execute(10, obj).then(function (value){
      expect(value).to.equal(200);

      return null;
    });
  });

  it('work with one conditional', function (){
    var cc, obj;

    obj = {
      _alterMe: 0,
      alterMe : function (){
        this._alterMe = 'altered';
      },
      add     : function (howmuch, value){
        return value + howmuch;
      },
      isntZero: function (value){
        return value !== 0;
      },
      isZero  : function (value){
        return this._alterMe === 0;
      }
    };

    cc = ChainCommander([
      {
        if: {
          check: [
            ['isntZero']
          ],
          else : {
            exec: [
              ['add', 10]
            ]
          }
        }
      },
      {
        if: {
          check: [
            ['isZero']
          ],
          exec : [
            ['alterMe']
          ]
        }
      }
    ]);

    return cc
      .execute(0, obj)
      .then(function (value){
        expect(obj._alterMe).to.equal('altered');
        expect(value).to.equal(10);

        return null;
      });
  });

  it('deals with exec returning another promise', function (){
    var cc, obj;

    obj = {
      returnPromise: function (value){
        return new Q(function(resolve) {
            setTimeout(function (){
            resolve({'After timeout: ': value});
            }, 10);
        });
      }
    };

    cc = ChainCommander({exec: [
      ['returnPromise']
    ]});

    return cc.execute(0, obj).then(function (val){
      expect(val).to.deep.equal({'After timeout: ': 0});

      return null;
    });
  });

  it('ifs work with promises', function (){
    var cc, obj, cmds = [
      {
        if: {
          check: [
            ['checkPromise']
          ],
          exec : [
            ['append', 'b']
          ]
        }
      },
      {
        if: {
          check: [
            ['checkPromise']
          ],
          exec : [
            ['append', 'c']
          ]
        }
      }
    ];

    obj = {
      append      : function (letter, value){
        return value + letter;
      },
      checkPromise: function (){
        return new Q(function(resolve){
            setTimeout(function (){
                resolve(true);
            }, 5);
        });
      }
    };

    cc = ChainCommander(cmds);
    return cc.execute('a', obj).then(function (value){
      expect(value).to.equal('abc');

      return null;
    });
  });

  it('test the given example', function (){
    var cc, cmds = [ // It uses arrays because it's the only way it can ensure order.
      {
        if: {
          // if (obj.check("first") and obj.check("second")) then
          check: [
            ['check', 'first'], // must match all
            ['check', 'second']
          ],
          // will be executed if obj.check("first") and obj.check("second") returns true
          exec : [
            ['multiply', 10]
          ],
          // neither checks were present, make another check
          // else works as "if not"
          else : {
            if  : {
              // else if (obj.check("third")) then
              check: [
                ['check', 'third'] // obj.check("third")
              ],
              // will be executed only the obj.check("third") returns true
              exec : [
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
      log       : function (args, value){
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
        return new Q(function(resolve, reject){
            if (this.secondPass === false) {
                setTimeout(function (){
                    resolve('Oops'); // this will be overwritten by the goOn "exec", that will continue from the previous value
                }, 1000);
            } else {
                reject(new Error('startTimer'));
            }
        });
      }
    };

    cc = ChainCommander(cmds);
    return cc.execute(10, instance).then(function (value){
        expect(value).to.equal(101);
        return null;
    });
  });

  it('use objects and change them while passing around', function (){
    var cc, nobj, context, cmds = [
      {
        exec: [
          ['changeValue', 'value1']
        ]
      },
      {
        exec: [
          ['changeValue', 'value2']
        ]
      },
      {
        exec: [
          ['changeValue', 'value3']
        ]
      }
    ];

    nobj = {
      value1: 1,
      value2: 2
    };

    context = {
      changeValue: function (name, value){
        if (value[name]) {
          value[name]++;
        } else {
          value[name] = null;
        }
      }
    };

    cc = ChainCommander(cmds);
    return cc.execute(nobj, context).then(function (value){
      expect(value).to.equal(nobj);
      expect(value).to.deep.equal({value1: 2, value2: 3, value3: null});

      return null;
    });
  });

  it('deep nested ifs and elses', function (){
    var cc, context, cmds = [
      {
        if: {
          check: [
            ['no']
          ],
          else : {
            if: {
              check: [
                ['no']
              ],
              else : {
                if  : {
                  check: [
                    ['yes']
                  ],
                  exec : [
                    ['done']
                  ]
                },
                exec: [
                  ['returnUndefined']
                ]
              }
            }
          }
        }
      },
      {
        if: {
          check: [
            ['no']
          ],
          else : {
            exec: [
              ['throws']
            ]
          }
        }
      }
    ];

    context = {
      no             : function (){
        return false;
      },
      yes            : function (){
        return true;
      },
      done           : function (value){
        return 'done';
      },
      returnUndefined: function (){
      },
      throws         : function (){
        throw new Error('else throw');
      }
    };

    cc = ChainCommander(cmds);

    return cc.execute(0, context).then(function (value){
      expect(value).to.equal('done');

      return null;
    });
  });

  it('work on instances', function (){
    var cc, cmds = [
      {
        if: {
          check: [
            ['check', 1]
          ],
          exec : [
            ['fromConstructor']
          ]
        }
      },
      {
        if: {
          check: [
            ['check', 2]
          ],
          else : {
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
          exec : [
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

    Context.prototype.check = function (type, value){
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

    Context.prototype.fromConstructor = function (value){
      this.count++;
      return this.func(value);
    };

    var context = new Context(function (value){ return ++value; });

    cc = ChainCommander(cmds);
    return cc.execute(0, context).then(function (value){
      expect(value).to.equal(4);
      expect(context.count).to.equal(7);

      return null;
    });
  });

  it('two if checks', function (){
    var context, cmds = [
      {
        if: {
          check: [
            ['returnFalse'],
            ['returnTrue']
          ],
          exec : [
            ['callIt']
          ]
        }
      }
    ], cc;

    context = {
      count      : 0,
      called     : false,
      returnTrue : function (){
        this.count++;
        return true;
      },
      returnFalse: function (){
        this.count++;
        return false;
      },
      callIt     : function (){
        this.called = true;
      }
    };

    cc = new ChainCommander(cmds);
    return cc.execute('', context).then(function (){
      expect(context.called).to.equal(false);
      expect(context.count).to.equal(1);

      return null;
    });
  });

  it('execute array of chain commanders', function (){
    var context, cmds = [
      {
        exec: [
          ['append']
        ]
      }
    ], ccs = [
      new ChainCommander(cmds),
      new ChainCommander(cmds),
      new ChainCommander(cmds),
      new ChainCommander(cmds),
      new ChainCommander(cmds)
    ];

    context = {
      count  : 0,
      letters: 'abcd',
      append : function (value){
        return value + this.letters[this.count++ % this.letters.length];
      }
    };

    return ChainCommander.all('wow-', ccs, context).then(function (value){
      expect(value).to.equal('wow-abcda');

      return null;
    });
  });

  it('passes the last parameter as the calling object', function(){
    var context = {
      val: function(add, value, obj) {
        expect(obj.exists).to.equal(true);
        return value + add + obj.add;
      },
      conditional: function(value, _obj) {
        expect(_obj).to.equal(obj);
        return _obj.exists;
      },
      success: function(){
        expect(arguments).to.have.length(2);
      }
    }, cc, obj = {add: '2', exists: true, defs: [{'exec':[['val','1']]},{'if':{'check':[['conditional']],'exec':[['success']]}}]};

    cc = new ChainCommander(obj, {member:'defs', throws: true});

    expect(cc.member).to.equal('defs');
    expect(cc.context).to.equal(obj);
    return cc.execute('a', context).then(function(val){
      expect(val).to.equal('a12');

      return null;
    });
  });

  it('taps to function', function(){
    var context = {
      val: function(add, value, obj) {
        if (obj) {
          expect(obj.exists).to.equal(true);
          return value + add + obj.add;
        } else {
          return value + add;
        }
      },
      conditional: function(value, _obj) {
        if (_obj) {
          expect(_obj).to.equal(obj);
          return _obj.exists;
        } else {
          return true;
        }
      },
      success: function(){
        expect(arguments).to.have.length(2);
      }
    }, calls = 0, ccs = [], obj = {add: '2', exists: true, defs: [{'exec':[['val','1']]},{'if':{'check':[['conditional']],'exec':[['success']]}}]};

    ccs.push(new ChainCommander(obj, {member:'defs'}));
    ccs.push([
      new ChainCommander(obj, {member:'defs'}),
      new ChainCommander(obj.defs)
    ]);
    ccs.push(new ChainCommander(obj, {member:'defs'}));

    return ChainCommander.all('a', ccs, context, function(val, _obj){
      calls++;
      if (_obj) {
        expect(_obj).to.equal(obj);
        _obj.chumba = true;
      }
    }).then(function(d){
      expect(d).to.equal('a1212112');
      expect(obj.chumba).to.equal(true);
      expect(calls).to.equal(4);

      return null;
    });
  });

  it('execute array of arrays of chain commanders and ignore non-instances', function (){
    var context, cmds = [
      {
        exec: [
          ['append']
        ]
      }
    ], ccs = [
      new ChainCommander(cmds),
      [new ChainCommander(cmds), new ChainCommander(cmds)],
      [new ChainCommander(cmds), new ChainCommander(cmds)],
      1,'ab'
    ];

    context = {
      count  : 0,
      letters: 'abcd',
      append : function (value){
        return value + this.letters[this.count++ % this.letters.length];
      }
    };

    return ChainCommander.all('wow-', ccs, context).then(function (value){
      expect(value).to.equal('wow-abcda');

      return null;
    });
  });

  it('forgiving on non existant checks and functions', function (){
    var cc;
    var obj = {thisOneDoes: function (plus, value){ return value + plus; }};
    var cmds = [
      {
        exec: [
          ['doesntExist']
        ]
      },
      {
        if: {
          check: [
            ['doesntExistEither']
          ],
          exec : [
            ['nonExistant']
          ]
        }
      },
      {
        exec: [
          ['thisOneDoes', 1]
        ]
      }
    ];

    cc = ChainCommander(cmds);
    return cc.execute(10, obj).then(function (value){
      expect(value).to.equal(11);

      return null;
    });
  });

  it('unforgiving definition', function (done){
    var cmds = [
        {
          if: {
            check: [
              ['dontExist']
            ]
          }
        },
        {
          if: {
            exec: [
              ['doh']
            ]
          }
        },
        {
          exec: [
            ['dontExists']
          ]
        }
      ];

    var thrown = 0;

    expect(function(){
        ChainCommander(cmds.slice(thrown-1), {member: 'dummy', throws: true});
    }).to.throw();

    var run = function (){
          var cc;

        cc = new ChainCommander(cmds.slice(thrown), {throws: true});

        cc.execute(0, {}).catch(function(err){
            switch (thrown) {
                case 0:
                    expect(err.message).to.equal('"if" function "dontExist" doesnt exists');
                    thrown++;
                    run();
                    break;
                case 1:
                    expect(err.message).to.equal('Missing "check" in "if"');
                    thrown++;
                    run();
                    break;
                case 2:
                    expect(err.message).to.equal('"exec" function "dontExists" doesnt exists');
                    thrown++;
                    done();
                    break;
            }
        });
    };

    run();
  });
});