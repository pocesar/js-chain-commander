[![Build Status](https://travis-ci.org/pocesar/js-chain-commander.png?branch=master)](https://travis-ci.org/pocesar/js-chain-commander) [![Coverage Status](https://coveralls.io/repos/pocesar/js-chain-commander/badge.png)](https://coveralls.io/r/pocesar/js-chain-commander)

Chain Commander
==================

Chain commander is a library based on [bluebird](https://github.com/petkaantonov/bluebird) library, to encapsulate
business rules logic in form of javascript objects or JSON.

Since it uses promises, it can keep going until no more "then"s are found, while mutating the value it started with.
You can store your commands in JSON or in a POJO (plain old javascript object), and execute them whenever you need,
asynchronously, associating them with a context.

You can change the business logic in your database/json definition files, and don't ever have to touch your frontend code,
it all depends on the context and your defined functions.

## Usage

Install from NPM:

```
npm install chain-commander
```

Require it in your node:

```js
var
    Q = require('bluebird'),
    cc = require('chain-commander')(Q);
```

or browser, after Bluebird:

```html
<script src="bluebird.min.js"></script>
<script src="chain-commander.js"></script>
```

## Business rules

Let's pretend you have a lot of users and each user have their own triggers and conditional, so they can
execute their own "code" in your app, like give instructions to your app to execute code in order they are meant to.

Basically, your definitions should not be aware of your object data, but your context functions should.
That means that if your object has an id, a name and some definitions, and if you want your function to
know the id, you should pass your objects to the `execute` function or a literal argument.

You can store anything in the the rules, from coordinates, sequence of commands, conditional statements, pairs of data.

The rules are meant to be "non verbose", to be easy to write and adapt, when testing with new rules on the database or json file
for example. It's also meant to feel natural and familiar to javascript (`if` and `else`, brackets and strings).

They offload the dynamic nature of your applcation to where it belongs: your data. The application code should only be prepared
to deal with whatever you throw at it.

```js
var cmds = [ // It uses arrays because it's the only way it can ensure order.
        {
          if: {
            // if (obj.check("first") and obj.check("second")) then

            check: [
              ['check', 'first'], // must match all
              ['check', 'second']
            ],

            // will be executed if obj.check("first") and obj.check("second") returns true

            // ALL checks can return promises as well

            exec      : [
              ['multiply', 10]
            ],

            // neither checks were present, make another check

            // "else" works as "if not"

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
```

Given the above object/JSON, you will create a new context that will deal with all the data in order:

```js
      var instance = {
        myvalue   : 3,
        check     : function (type, value){ // if in your definition, you call your function with paramters, the last param
                                            // (in this case, called "value") will always be the current value in chain
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
          console.log(args.msg + ': ' + value); // does nothing, just logs to console
          return value;
        },
        goOn      : function (value){
          if (!this.secondPass) { // pay attention that the context is at the moment of the execution

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
        console.log(value);
        // outputs 101, since the value at goOn time is 100, so the first check fails, and adds 1
        done();
      });
```

The above is a "silly" example (although a long one).

For a full-fledged practical example, check the `example` folder, there's a "build your plan with combos and many activities"
type of app created with Chain Commander and AngularJS (do a `bower install` inside that folder first)

## API

### `new ChainCommander(Array|String definitions, Object options)`

Creates a new predefined chain that will execute your code when you call `execute`

```js
var cc = new ChainCommander([{"exec":[["oops"]]}], {debug: true, throws: true});
```

### `ChainCommander.prototype.execute(* initialValue, Object|Function context)`

Executes your definitions on the given context. Returns a promise.

```js
var
    cc = new ChainCommander([{"exec":[["oops"]]}], {debug: true, throws: true}),
    context = {
        oops: function(){
        }
    };

cc.execute({initial: 'a', value: 0}, context).done(function(value){
  console.log(value);
});
```

### `ChainCommander.all(* value, Array arr, Object|Function context)`

Taking that you have an array with many Chain Commanders, that you want to execute in order, with the same context
returning a promise in the end:

```js
ChainCommander.all('initial value', arrayOfCommanders, context).done(function(value){
  // initial value transformed
});
```

the arrayOfCommanders also allow an array of array of Commanders, that means, you can use it like this:

```js
function getSelectedAndReturnArray(arr){
    return arr
        .filter(function(i){ return i.selected; })
        .map(function(i){ return i.cmds; });
}

var arrayOfItemsThatGotCommanders1 = [createCommander(0), createCommander(1) /*...*/];

ChainCommander.all('initial value', [
    getSelectedAndReturnArray(arrayOfItemsThatGotCommanders1),
    commanderInstance
], context).done(function(value){
  // value = 'initial value' transformed
});
```

## Debug

The definition and the executing code is "forgiving", it means, if you try to use a function that doesnt exists,
it will fail silently and continue in the chain.

You can watch the flow in a verbose mode setting the `debug` option to `true`

```js
var cc = ChainCommander(definitionArray, {debug: true, throws: true});
```

then watch your console. If you want to spot undefined functions or mismatched arguments, set `throws` to `true`.

**Never use any of those in production, since they might generate a lot of unresolved promises.**

