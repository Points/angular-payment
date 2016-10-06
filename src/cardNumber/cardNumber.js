angular.module('payment.cardNumber', ['payment.service', 'payment.restrictNumeric'])
    .directive('cardNumberInput', function () {
        'use strict';
        return {
            restrict: 'E',
            templateUrl: 'template/cardNumber/cardNumber.html',
            replace: true
        };
    })

    .directive('cardNumberFormatter', ['$timeout', '$parse', 'payment', function ($timeout, $parse, payment) {
        'use strict';
        var restrictCardNumber = function (e) {
                var card, digit = String.fromCharCode(e.which || e.keyCode), value, elm = angular.element(e.currentTarget || e.srcElement);

                if (!/^\d+$/.test(digit)) { return; }
                if (payment.hasTextSelected(elm)) { return; }

                value = (elm.val() + digit).replace(/\D/g, '');
                card = payment.cardFromNumber(value);

                if (card && value.length > card.length[card.length.length - 1]) {
                    e.preventDefault();
                } else if (value.length > 16) {
                    e.preventDefault();
                }
            },
            formatCardNumber = function (e) {
                var elm, card, digit, length, re, upperLength = 16, value;

                digit = String.fromCharCode(e.which || e.keyCode);
                if (!/^\d+$/.test(digit)) { return; }

                elm = angular.element(e.currentTarget || e.srcElement);
                value = elm.val();
                card = payment.cardFromNumber(value + digit);
                length = (value.replace(/\D/g, '') + digit).length;

                if (card) { upperLength = card.length[card.length.length - 1]; }
                if (length >= upperLength) { return; }
                if ((elm.prop('selectionStart') !== null) && elm.prop('selectionStart') !== value.length) { return; }
                if (card && card.type === 'amex') {
                    re = /^(\d{4}|\d{4}\s\d{6})$/;
                } else {
                    re = /(?:^|\s)(\d{4})$/;
                }

                if (re.test(value)) {
                    e.preventDefault();
                    elm.val(value + ' ' + digit);
                } else if (re.test(value + digit)) {
                    e.preventDefault();
                    elm.val(value + digit + ' ');
                }
            },
            trimCardNumber = function (e) {
              var keyCode = e.which || e.keyCode;
              var backspace = 8;
              if (keyCode !== backspace) return;

              var elm = angular.element(e.currentTarget || e.srcElement);
              var value = elm.val();
              var selectionStart = elm.prop('selectionStart');
              if (selectionStart === null) return;
              if (selectionStart !== value.length) return;

              if (/\s/.test(value.slice(-1))) {
                elm.val(value.slice(0, -1));
              }
            },
            reFormatCardNumber = function (e) {
                var elm = angular.element(e.currentTarget || e.srcElement);
                $timeout(function () {
                    var value = elm.val();
                    value = payment.formatCardNumber(value);
                    elm.val(value);
                });
            };

        return {
            require: 'ngModel',
            link: function postLink(scope, element, attrs, ngModelCtrl) {
                var cardType = $parse(attrs.cardType);

                element.bind('keypress', restrictCardNumber);
                element.bind('keypress', formatCardNumber);
                element.bind('keydown', trimCardNumber);
                element.bind('paste', reFormatCardNumber);

                function applyCardType(value) {
                    if (attrs.cardType) {
                        var card = payment.cardFromNumber(value);
                        cardType.assign(scope, (card && cardType !== card.type) ? card.type : null);
                    }
                }

                ngModelCtrl.$formatters.unshift(function (value) {
                    applyCardType(value);
                    return payment.formatCardNumber(value);
                });

                ngModelCtrl.$parsers.unshift(function (value) {
                    applyCardType(value);
                    return value;
                });
            }
        };
    }])

    .directive('cardNumberValidator', ['payment', function (payment) {
        'use strict';
        return {
            require: 'ngModel',
            link: function (scope, elm, attrs, ngModelCtrl) {
                function validate(value) {
                    if (!value) { return false; }
                    var valid = payment.validateCardNumber(value);
                    ngModelCtrl.$setValidity('cardNumber', valid);
                    return valid;
                }

                ngModelCtrl.$parsers.push(function (value) {
                    return validate(value) ? value.replace(/ /g, '') : undefined;
                });

                ngModelCtrl.$formatters.unshift(function (value) {
                    validate(value);
                    return value;
                });
            }
        };
    }]);
