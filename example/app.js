(function(){
  var App = angular.module('app', []);

  App.factory('State', ['$http', '$timeout', function($http, $timeout){
    var obj, lookup = {}, discounted = 0;

    $http.get('definition.json').then(function(res){
      var i;
      for (var x in {'items':1,durations:1,behaviors:1}){
        for(i = 0; i < res.data[x].length; i++) {
          res.data[x][i].definitions = new ChainCommander(res.data[x][i].definitions, {debug: true});
        }
      }

      obj.items = res.data.items;
      for(i = 0; i < obj.items.length; i++) {
        lookup[obj.items[i].id] = obj.items[i];
      }
      obj.combos = res.data.combos;
      obj.durations = res.data.durations;
      obj.behaviors = res.data.behaviors;
    });

    var makeSelectedArray = function(items){
      items = items.filter(function(i){
        return lookup[i].selected === true;
      }).map(function(i){
        return i;
      });

      items.sort(function(a, b){
        return b - a;
      });

      return items.join(',');
    };

    var context = {
      combo: function(combos){
        // check if the current selected items make a combo
        return combos.join(',') === makeSelectedArray(combos);
      },
      sum: function(price, _obj) {
        if (Array.isArray(price)) {
          // combos have their own prices
          price.forEach(function(p){
            // applied the discount per item
            _obj.combos[p] = obj.combos[price.join(',')].value;
          });
        } else {
          // apply plain price
          _obj.total += price;
        }
        return _obj;
      },
      discount: function(discount, obj) {
        // discounts accumulate to be applied at the end
        obj.accumulatedDiscount += discount;
        return obj;
      },
      multiply: function(times, obj) {
        // duration changes the total price
        obj.times = times;
        return obj;
      }
    };

    function selected(item){
      return item.filter(function(i){
        return i.selected === true;
      }).map(function(i){
        return i.definitions;
      });
    }

    function process() {
      discounted = 0;
      return ChainCommander.all({accumulatedDiscount: 0, total: 0, combos: {}, times: 1}, [
        selected(obj.items),
        selected(obj.behaviors),
        selected(obj.durations)
      ], context).then(function(r){
        $timeout(function(){
          for(var i in r.combos) {
            // combos do not apply to the total, but per item
            r.total += lookup[i].price - (lookup[i].price * r.combos[i]);
            discounted += r.combos[i];
          }
          obj.total = r.total * r.times;
          obj.discountedTotal = obj.total - (obj.total * r.accumulatedDiscount);
          discounted += r.accumulatedDiscount;
        });
        return r;
      });
    }

    function discount(text) {
      var t = discounted * 100;
      return t === 0 ? '' : (text || '') + ((t).toFixed(1)) + '%';
    }

    obj = {
      total: 0,
      discountedTotal: 0,
      discount: discount,
      behaviors: [],
      combos: {},
      items: [],
      durations: [],
      process: process
    };

    return obj;
  }]);

  App.controller('MainCtrl', ['$http', 'State', 'inflectFilter', 'currencyFilter', function($http, State, filter, currency){
    var self = this;

    function compileOrder(){
      var out = [], discounted, i, text = '', items = [];
      for (i in State.behaviors) {
        if (State.behaviors[i].selected) {
          text = 'You are a "' + State.behaviors[i].name + '" person';
          break;
        }
      }
      text += ' that likes \n';
      for (i in State.items) {
        if (State.items[i].selected) {
          items.push(State.items[i].name);
        }
      }
      text += items.join('\n') + '\n\n';
      text += 'that will be doing it for ';
      for(i in State.durations) {
        if (State.durations[i].selected) {
          text += filter(State.durations[i].length, 'month');
          break;
        }
      }

      out.push(text);

      out.push('for a grand total of: ' + currency(State.discountedTotal) + '\n');
      discounted = State.discount();
      if (discounted) {
        out.push('That is ' + discounted + ' off!');
      }
      return out.join('\n');
    }

    self.go = function(){
      if (State.total) {
        alert('About to buy: \n\n' + compileOrder());
      } else {
        alert('Pick some items first');
      }
    };

    self.state = State;

  }]);

  App.filter('inflect', function(){
    return function(value, base){
      return value + ' ' + (value > 1 ? base + 's' : base);
    };
  });

  App.directive('clicky', ['State', function(State){
    return {
      restrict: 'A',
      scope: {
        type: '@clicky'
      },
      replace: true,
      templateUrl: 'clicky.html',
      controller: ['$scope', function($scope){
        var
          self = this;

        self.type = $scope.type;

        self.state = State[self.type];

        self.click = function(item){
          switch (self.type) {
            case 'durations':
            case 'behaviors':
              item.selected = !item.selected;
              self.state.forEach(function(i){
                if (i !== item) {
                  i.selected = false;
                }
              });
              break;
            case 'items':
              item.selected = !item.selected;
              break;
          }
          State.process().then(function(){

          });
        };

      }],
      controllerAs: 'clickyCtrl'
    };
  }]);

})();
