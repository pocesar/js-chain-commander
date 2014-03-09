describe('Chain Commander', function (){

  it('accepts both JSON and Javascript POJO', function (){
    var cc;

    cc = ChainCommander('{}');
    expect(cc.obj).to.eql([
      {}
    ]);

    cc = ChainCommander({});
    expect(cc.obj).to.eql([
      {}
    ]);
  });

  it('if without member check is forgiving', function (done){
    ChainCommander([
      {if: {
        exec: [
          ['done']
        ]
      }}
    ]).execute('ok', {}).then(function (value){
      expect(value).to.equal('ok');
      done();
    }).done();
  });

  it('exec call functions in the context object', function (done){
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

    cc.execute(10, obj).done(function (value){
      expect(value).to.be(200);
      done();
    });
  });

  it('work with one conditional', function (done){
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

    cc
      .execute(0, obj)
      .done(function (value){
        expect(obj._alterMe).to.be('altered');
        expect(value).to.be(10);
        done();
      });
  });

  it('deals with exec returning another promise', function (done){
    var cc, obj;

    obj = {
      returnPromise: function (value){
        var d = Q.pending();

        setTimeout(function (){
          d.resolve({'After timeout: ': value});
        }, 10);

        return d.promise;
      }
    };

    cc = ChainCommander({exec: [
      ['returnPromise']
    ]});

    cc.execute(0, obj).done(function (val){
      expect(val).to.eql({'After timeout: ': 0});
      done();
    });
  });

  it('ifs work with promises', function (done){
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
        var d = Q.defer();

        setTimeout(function (){
          d.resolve(true);
        }, 5);

        return d.promise;
      }
    };

    cc = ChainCommander(cmds);
    cc.execute('a', obj).done(function (value){
      expect(value).to.be('abc');
      done();
    });
  });

  it('test the given example', function (done){
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

    cc = ChainCommander(cmds);
    cc.execute(10, instance).done(function (value){
      expect(value).to.equal(101);
      done();
    });

  });

  it('use objects and change them while passing around', function (done){
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
    cc.execute(nobj, context).done(function (value){
      expect(value).to.be(nobj);
      expect(value).to.eql({value1: 2, value2: 3, value3: null});
      done();
    });
  });

  it('deep nested ifs and elses', function (done){
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

    cc.execute(0, context).done(function (value){
      expect(value).to.be('done');
      done();
    });
  });

  it('work on instances', function (done){
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
    cc.execute(0, context).done(function (value){
      expect(value).to.be(4);
      expect(context.count).to.be(7);
      done();
    });
  });

  it('two if checks', function (done){
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
    cc.execute('', context).then(function (){
      expect(context.called).to.be(false);
      expect(context.count).to.be(1);
    }).done(done);
  });

  it('execute array of chain commanders', function (done){
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

    ChainCommander.all('wow-', ccs, context).then(function (value){
      expect(value).to.equal('wow-abcda');
    }).done(done);
  });

  it('execute array of arrays of chain commanders and ignore non-instances', function (done){
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

    ChainCommander.all('wow-', ccs, context).then(function (value){
      expect(value).to.equal('wow-abcda');
    }).done(done);
  });

  it('forgiving on non existant checks and functions', function (done){
    var cc, obj = {thisOneDoes: function (plus, value){ return value + plus; }}, cmds = [
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
    cc.execute(10, obj).done(function (value){
      expect(value).to.be(11);
      done();
    });
  });

  it('unforgiving definition', function (done){
    if (typeof domain === 'undefined') {
      // not meant for the browser
      done();
      return;
    }
    var execDomain = domain.create(),
      cmds = [
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

    var run = function (){
      var cc;

      cc = new ChainCommander(cmds.slice(thrown), {throws: true});
      execDomain.run(function (){
        cc.execute(0, {}).done(function (){});
      });
    };

    execDomain.on('error', function (err){
      switch (thrown) {
        case 0:
          expect(err.message).to.be('"if" function "dontExist" doesnt exists');
          thrown++;
          run();
          break;
        case 1:
          expect(err.message).to.be('Missing "checks" in "if"');
          thrown++;
          run();
          break;
        case 2:
          expect(err.message).to.be('"exec" function "dontExists" doesnt exists');
          done();
          break;
      }
    });

    run();
  });
});