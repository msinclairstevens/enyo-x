/*jshint node:true, indent:2, curly:true eqeqeq:true, immed:true, latedef:true, newcap:true, noarg:true,
regexp:true, undef:true, trailing:true, white:true */
/*global XT:true, XV:true, XM:true, Backbone:true, enyo:true, _:true */

(function () {

  /**

    @class
    @name XV.MenuItem
    @extends onyx.MenuItem
   */
  enyo.kind(/** @lends XV.MenuItem# */{
    name: "XV.MenuItem",
    kind: "onyx.MenuItem",
    classes: "xv-menuitem",
    published: {
      disabled: false
    },
    /**
    @todo Document disabledChanged method.
    */
    disabledChanged: function () {
      this.addRemoveClass("disabled", this.disabled);
    },
    /**
    @todo Document tap method.
    */
    tap: function (inSender) {
      if (!this.disabled) { return this.inherited(arguments); }
    }
  });

}());
