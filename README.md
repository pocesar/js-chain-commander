Chain Commander
==================

Chain commander is a library based on [Q](https://github.com/kriskowal/q) library, to encapsulate
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
    Q = require('q'),
    cc = require('chain-commander')(Q);
```

or browser, after Q:

```html
<script src="q.js"></script>
<script src="chain-commander.js"></script>
```

## Business rules

Let's pretend you have a lot of users and each user have their own triggers and conditional, so they can
execute their own "code" in your app, like give instructions to your app to execute code in order they are meant to.

The rules are meant to be "non verbose", to be easy to write and adapt easily, when testing with new rules on the database for example.

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
```

Given the above object/JSON, you will create a new function that will execute everything in order:

```js
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
        console.log(value);
        // outputs 101, since the value at goOn time is 100, so the first check fails, and adds 1
        done();
      });
```

The above is a silly example, below is a more serious usage, in a "build your plan with combos and many activities" type of app:

The below example is a directive in AngularJS:

```js
app.directive('selectItem', function($timeout){
    return {
        restrict: 'A',
        controller: function($scope){
            var allItems = function(ids, state, where){
                for(var i = 0, len = $scope.items.length; i < len; i++) {
                    if (ids.indexOf($scope.items[i].id) !== -1) {
                        $scope.items[i][where] = state;
                    }
                }
            };

            // this is a chained command, if you don't return anything, the value passed to the execute
            // will remain unchanged
            this.select = function(ids){
                allItems(ids, $scope.item.selected, 'selected');
            };

            // this is a conditional function, must return true or false
            this.isSelected = function(){
                return $scope.item.selected;
            };

            this.toggle = function(ids){
                allItems(ids, !$scope.item.selected, 'visible');
            };

            // this is a conditional function, must return true or false
            this.isCombo = function(ids){
                if (ids.indexOf(scope.item.id) !== -1){
                    return true;
                }
                return false;
            };

            this.sum = function(){
                value = 0;
                for(var i = 0, len = $scope.items.length; i < len; i++) {
                    if ($scope.items[i].selected) {
                        value += $scope.items[i].price;
                    }
                }
                return value;
            }
        },
        link: function(scope, element, attrs, controller){
            element.on('click', function(){
                scope.item.definition(0, controller).done(function(value){
                    $timeout(function(){
                        scope.value = value;
                    });
                });
            });
        }
    };
});

app.controller('SelectCtrl', function($scope, $http){
    $scope.value = 0;
    $scope.items = [];

    $http.get('/items.json').success(function(items){
        $scope.items = items;

        for(var i = 0, len = $scope.items.length; i < len; i++){
            // transform our definitions to a chain of commands
            // this is done once, unless you need to change the definition later on
            $scope.items[i].definition = new ChainCommander($scope.items.definition);
        }
    });
});
```

This is `items.json`:

```json
[
    {
        "name":"Sky diving",
        "selected":false,
        "visible":true,
        "id":1,
        "price":2900,
        "definitions":[]
    },
    {
        "name":"Snowboarding",
        "selected":false,
        "visible":true,
        "id":2,
        "combo":[4],
        "price":780,
        "definitions":[
            {"if": {
                "conditions":[
                    ["isSelected"]
                ],
                "exec":[
                    ["toggle",[1,3]]
                ]
            }},
            {"if": {
                "conditions":[
                    ["isCombo"]
                ],
                "exec":[
                    ["discount"],
                    ["sum"]
                ]
            }}
        ]
    },
    {
        "name":
        "Scuba Diving",
        "selected":false,
        "visible":true,
        "id":3,
        "price":250,
        "definitions":[]
    },
    {
        "name":"Trail Bike",
        "selected":false,
        "visible":true,
        "id":4,
        "price":1250,
        "definitions":[
            {"if": {
                "conditions":[
                    ["isSelected"]
                ],
                "exec":[
                    ["toggle",[1,2,3]]
                ]
            }}
        ]
    }
]
```

## Debug

The definition and the executing code is "forgiving", it means, if you try to use a function that doesnt exists,
it will fail silently and continue in the chain. You can disable this by setting the instance "throws" to true

You can watch the flow in a verbose mode setting the

```js
var cc = ChainCommander(cmds, {debug: true, throws: true});
```

then watch your console

