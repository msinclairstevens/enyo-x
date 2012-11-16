/*jshint bitwise:false, indent:2, curly:true eqeqeq:true, immed:true,
latedef:true, newcap:true, noarg:true, regexp:true, undef:true,
trailing:true white:true*/
/*global XT:true, XM:true, XV:true, _:true, enyo:true*/

(function () {

  /**
    @class Use this class to define the editor for `XV.ListRelationsEditorBox`.
    @name XV.RelationsEditor
    @extends XV.Groupbox
    @see XV.ListRelationsEditorBox
  */
  var editor = enyo.mixin(XV.EditorMixin, {
    name: "XV.RelationsEditor",
    kind: "XV.Groupbox",
    handlers: {
      onValueChange: "controlValueChanged"
    },
    /**
    @todo Document the destroy method.
    */
    destroy: function () {
      this.value = null;
      this.inherited(arguments);
    },
    /**
    @todo Document the setValue method.
    */
    setValue: function (value) {
      this.value = value;
      this.attributesChanged(value);
    }
  });
  enyo.kind(editor);

  /**
    @class Must include a component called `list`.
    List must be of sub-kind `XV.ListRelations`.
    The `value` must be set to a collection of `XM.Model`.
    @name XV.ListRelationsEditorBox
    @extends XV.Groupbox
    @see XV.RelationsEditor
  */
  enyo.kind(/** @lends XV.ListRelationsEditorBox# */{
    name: "XV.ListRelationsEditorBox",
    kind: "XV.Groupbox",
    classes: "panel xv-relations-editor-box",
    published: {
      attr: null,
      value: null,
      title: "",
      parentKey: "",
      listRelations: "",
      editor: null,
      fitButtons: true
    },
    handlers: {
      onSelect: "selectionChanged",
      onDeselect: "selectionChanged",
      onTransitionFinish: "transitionFinished",
      onValueChange: "controlValueChanged"
    },
    /**
    @todo Document the attrChanged method.
    */
    attrChanged: function () {
      this.$.list.setAttr(this.attr);
    },
    /**
    @todo Document the controlValueChanged method.
    */
    controlValueChanged: function () {
      this.$.list.refresh();
      return true;
    },
    /**
    @todo Document the create method.
    */
    create: function () {
      this.inherited(arguments);
      var editor = this.getEditor(),
        panels,
        control;

      // Header
      this.createComponent({
        kind: "onyx.GroupboxHeader",
        content: this.getTitle()
      });

      // List
      panels = {
        kind: "Panels",
        fit: true,
        arrangerKind: "CollapsingArranger",
        components: [
          {kind: editor, name: "editor"},
          {kind: this.getListRelations(), name: "list",
            attr: this.getAttr(), fit: true}
        ]
      };
      control = this.createComponent(panels);
      control.setIndex(1);

      // Buttons
      this.createComponent({
        kind: "FittableColumns",
        classes: "xv-groupbox-buttons",
        components: [
          {kind: "onyx.Button", name: "newButton", onclick: "newItem",
            content: "_new".loc(), classes: "xv-groupbox-button-left"},
          {kind: "onyx.Button", name: "deleteButton", onclick: "deleteItem",
            content: "_delete".loc(), classes: "xv-groupbox-button-center",
            disabled: true},
          {kind: "onyx.Button", name: "prevButton", onclick: "prevItem",
            content: "<", classes: "xv-groupbox-button-center",
            disabled: true},
          {kind: "onyx.Button", name: "nextButton", onclick: "nextItem",
            content: ">", classes: "xv-groupbox-button-center",
            disabled: true},
          {kind: "onyx.Button", name: "doneButton", onclick: "doneItem",
            content: "_done".loc(), classes: "xv-groupbox-button-right",
            disabled: true, fit: this.getFitButtons()}
        ]
      });

    },
    /**
    @todo Document the deleteItem method.
    */
    deleteItem: function () {
      var index = this.$.list.getFirstSelected(),
        model = index ? this.$.list.getModel(index) : null;
      this.$.list.getSelection().deselect(index, false);
      model.destroy();
      this.$.list.lengthChanged();
    },
    /**
    @todo Document the doneItem method.
    */
    doneItem: function () {
      var index = this.$.list.getFirstSelected(),
        selection = this.$.list.getSelection();
      selection.deselect(index);
    },
    /**
    @todo Document the newItem method.
    */
    newItem: function () {
      var collection = this.$.list.getValue(),
        Klass = collection.model,
        model = new Klass(null, {isNew: true});
      this.$.editor.clear();
      collection.add(model);
      this.$.list.select(collection.length - 1);
    },
    /**
    @todo Document the nextItem method.
    */
    nextItem: function () {
      var index = this.$.list.getFirstSelected() - 0;
      this.$.list.select(index + 1);
    },
    /**
    @todo Document the prevItem method.
    */
    prevItem: function () {
      var index = this.$.list.getFirstSelected() - 0;
      this.$.list.select(index - 1);
    },
    /**
    @todo Document the selectionChanged method.
    mss: Detects whether the user has selected a different item...and then what?
    */
    selectionChanged: function (inSender, inEvent) {
      var index = this.$.list.getFirstSelected(),
        model = index ? this.$.list.getModel(index) : null,
        that = this;
      this.$.deleteButton.setDisabled(true);
      this.$.doneButton.setDisabled(!index);
      if (index) {
        this.$.editor.setValue(model);
        if (model.isNew()) {
          this.$.deleteButton.setDisabled(false);
        } else {
          model.used({
            success: function (resp) {
              that.$.deleteButton.setDisabled(resp);
            }
          });
        }
        if (this.$.panels.getIndex()) { this.$.panels.setIndex(0); }
        this.$.prevButton.setDisabled(index - 0 === 0);
        this.$.nextButton.setDisabled(index - 0 === this.$.list.value.length - 1);
      } else {
        if (!this.$.panels.getIndex()) { this.$.panels.setIndex(1); }
        this.$.prevButton.setDisabled(true);
        this.$.nextButton.setDisabled(true);
      }
    },
    /**
    @todo Document the transitionFinished method.
    */
    transitionFinished: function (inSender, inEvent) {
      if (inEvent.originator.name === 'panels') {
        if (this.$.panels.getIndex() === 1) {
          this.doneItem();
        }
        return true;
      }
    },
    /**
    @todo Doucment the valueChanged method.
    */
    valueChanged: function () {
      var value = this.getValue();
      this.$.list.setValue(value);
    }
  });

}());
