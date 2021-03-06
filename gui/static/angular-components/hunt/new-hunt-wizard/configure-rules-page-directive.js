'use strict';

goog.provide('grrUi.hunt.newHuntWizard.configureRulesPageDirective.ConfigureRulesPageController');
goog.provide('grrUi.hunt.newHuntWizard.configureRulesPageDirective.ConfigureRulesPageDirective');

goog.scope(function() {

/**
 * Controller for ConfigureRulesPageDirective.
 *
 * @param {!angular.Scope} $scope
 * @param {!grrUi.core.reflectionService.ReflectionService} grrReflectionService
 * @param {!grrUi.core.apiService.ApiService} grrApiService
 * @constructor
 * @ngInject
 */
grrUi.hunt.newHuntWizard.configureRulesPageDirective
    .ConfigureRulesPageController = function(
        $scope, grrReflectionService, grrApiService) {
  /** @private {!angular.Scope} */
  this.scope_ = $scope;

  /** @private {!grrUi.core.apiService.ApiService} */
  this.grrApiService_ = grrApiService;

  /** @private {!grrUi.core.reflectionService.ReflectionService} */
  this.grrReflectionService_ = grrReflectionService;

  /** @type {Object} */
  this.regexRuleDescriptor;

  /** @type {Object} */
  this.integerRuleDescriptor;

  /** @type {Array<Object>} */
  this.rules;

  this.allowedRuleTypes = [
    {title: 'Windows', value: 'windows'},
    {title: 'Linux', value: 'linux'},
    {title: 'OS X', value: 'darwin'},
    {title: 'Clients With Label', value: 'label'},
    {title: 'Regular Expression', value: 'regex'},
    {title: 'Integer Rule', value: 'integer'}
  ];

  this.grrReflectionService_.getRDFValueDescriptor(
      'ForemanAttributeRegex').then(function(descriptor) {
        this.regexRuleDescriptor = descriptor;
      }.bind(this));

  this.grrReflectionService_.getRDFValueDescriptor(
      'ForemanAttributeInteger').then(function(descriptor) {
        this.integerRuleDescriptor = descriptor;
      }.bind(this));

  this.labelsList = [];
  this.grrApiService_.get('/clients/labels').then(function(response) {
    this.labelsList = response['data']['labels'];
  }.bind(this));

  this.scope_.$watch('controller.rules',
                     this.onInnerRulesChange_.bind(this),
                     true);
  this.scope_.$watchGroup(['regexRules', 'integerRules'],
                          this.onOuterRulesBindingChange_.bind(this));
};
var ConfigureRulesPageController =
    grrUi.hunt.newHuntWizard.configureRulesPageDirective
    .ConfigureRulesPageController;

/**
 * Handles changes in rules representation currently bound to this directive's
 * DOM.
 *
 * @private
 */
ConfigureRulesPageController.prototype.onInnerRulesChange_ = function() {
  if (angular.isUndefined(this.rules)) {
    return;
  }

  this.scope_['regexRules'].splice(0, this.scope_['regexRules'].length);
  this.scope_['integerRules'].splice(0, this.scope_['integerRules'].length);

  angular.forEach(this.rules, function(rule) {
    var regexRule, integerRule;

    if (rule['type'] == 'windows') {
      regexRule = angular.copy(this.regexRuleDescriptor['default']);
      regexRule['value']['attribute_name'] = {
        type: 'RDFString',
        value: 'System'
      };
      regexRule['value']['attribute_regex'] = {
        type: 'RegularExpression',
        value: 'Windows'
      };
    } else if (rule['type'] == 'linux') {
      regexRule = angular.copy(this.regexRuleDescriptor['default']);
      regexRule['value']['attribute_name'] = {
        type: 'RDFString',
        value: 'System'
      };
      regexRule['value']['attribute_regex'] = {
        type: 'RegularExpression',
        value: 'Linux'
      };
    } else if (rule['type'] == 'darwin') {
      regexRule = angular.copy(this.regexRuleDescriptor['default']);
      regexRule['value']['attribute_name'] = {
        type: 'RDFString',
        value: 'System'
      };
      regexRule['value']['attribute_regex'] = {
        type: 'RegularExpression',
        value: 'Darwin'
      };
    } else if (rule['type'] == 'label') {
      regexRule = angular.copy(this.regexRuleDescriptor['default']);
      regexRule['value']['attribute_name'] = {
        type: 'RDFString',
        value: 'Labels'
      };

      var escapedLabel = rule['labelValue'].replace(
          /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

      regexRule['value']['attribute_regex'] = {
        type: 'RegularExpression',
        value: '(.+,|\\A)' + escapedLabel + '(,.+|\\Z)'
      };
    } else if (rule['type'] == 'regex') {
      regexRule = rule.regexValue;
    } else if (rule['type'] == 'integer') {
      integerRule = rule.integerValue;
    }

    if (angular.isDefined(regexRule)) {
      this.scope_['regexRules'].push(regexRule);
    }
    if (angular.isDefined(integerRule)) {
      this.scope_['integerRules'].push(integerRule);
    }
  }.bind(this));
};

/**
 * Handles changes in this directive's regexRules and/or integerRules bindings.
 *
 * @private
 */
ConfigureRulesPageController.prototype.onOuterRulesBindingChange_ = function() {
  if (angular.isDefined(this.rules)) {
    return;
  }

  if (angular.isUndefined(this.scope_['regexRules']) ||
      angular.isUndefined(this.scope_['integerRules'])) {
    return;
  }

  this.rules = [];

  angular.forEach(this.scope_['regexRules'], function(regexRule) {
    this.rules.push({
      type: 'regex',
      regexValue: regexRule
    });
  }.bind(this));

  angular.forEach(this.scope_['integerRules'], function(integerRule) {
    this.rules.push({
      type: 'integer',
      integerValue: integerRule
    });
  }.bind(this));

  if (this.rules.length == 0) {
    this.rules.push({
      type: 'windows'
    });
  }
};

/**
 * Called when user changes type of a rule.
 *
 * @param {!Object} rule Rule which type has changed.
 * @export
 */
ConfigureRulesPageController.prototype.ruleTypeChanged = function(rule) {
  if (angular.isUndefined(rule['labelValue'])) {
    rule['labelValue'] = (this.labelsList.length > 0 ?
        this.labelsList[0].value.name.value : null);
  }

  if (angular.isUndefined(rule.regexValue)) {
    rule['regexValue'] = angular.copy(this.regexRuleDescriptor['default']);
  }

  if (angular.isUndefined(rule.integerValue)) {
    rule['integerValue'] = angular.copy(this.integerRuleDescriptor['default']);
  }
};


/**
 * Adds new rule to the list.
 *
 * @export
 */
ConfigureRulesPageController.prototype.addRule = function() {
  this.rules.splice(0, 0, {
    type: this.allowedRuleTypes[0].value
  });
};

/**
 * Removes rule with a given index from the list.
 *
 * @param {number} index Index of a rule to be removed.
 * @export
 */
ConfigureRulesPageController.prototype.removeRule = function(index) {
  this.rules.splice(index, 1);
};

/**
 * Directive for showing wizard-like forms with multiple named steps/pages.
 *
 * @constructor
 * @ngInject
 * @export
 */
grrUi.hunt.newHuntWizard.configureRulesPageDirective
    .ConfigureRulesPageDirective = function() {
  return {
    scope: {
      regexRules: '=',
      integerRules: '='
    },
    restrict: 'E',
    templateUrl: '/static/angular-components/hunt/new-hunt-wizard/' +
        'configure-rules-page.html',
    controller: ConfigureRulesPageController,
    controllerAs: 'controller'
  };
};


/**
 * Directive's name in Angular.
 *
 * @const
 * @export
 */
grrUi.hunt.newHuntWizard.configureRulesPageDirective
    .ConfigureRulesPageDirective
    .directive_name = 'grrConfigureRulesPage';

});  // goog.scope
