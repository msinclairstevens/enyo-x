/*jshint node:true, indent:2, curly:true eqeqeq:true, immed:true, latedef:true, newcap:true, noarg:true,
regexp:true, undef:true, trailing:true, white:true */
/*global XT:true, XV:true, XM:true, Backbone:true, enyo:true, _:true */

(function () {

  /**
    Implements a dropdown. Unlike the {XV.RelationWidget}, the collection is stored local to the
    widget.

    @class
    @name XV.RelationWidget
   */
  enyo.kind(/** @lends XV.RelationWidget# */{
    name: "XV.RelationWidget",
    kind: enyo.Control,
    classes: "xv-inputwidget xv-relationwidget",
    published: {
      attr: null,
      label: "",
      placeholder: "",
      value: null,
      list: "",
      collection: "",
      disabled: false,
      keyAttribute: "number",
      nameAttribute: "name",
      descripAttribute: ""
    },
    events: {
      onSearch: "",
      onValueChange: "",
      onWorkspace: ""
    },
    handlers: {
      onModelChange: "modelChanged",
      onSelect: "itemSelected"
    },
    components: [
      {kind: "FittableColumns", components: [
        {name: "label", content: "", classes: "xv-decorated-label"},
        {kind: "onyx.InputDecorator", name: "decorator",
          classes: "xv-input-decorator", components: [
          {name: 'input', kind: "onyx.Input", classes: "xv-subinput",
            onkeyup: "keyUp", onkeydown: "keyDown", onblur: "receiveBlur",
            onfocus: "receiveFocus"
          },
          {kind: "onyx.MenuDecorator", components: [
            {kind: "onyx.IconButton", src: "lib/enyo-x/assets/triangle-down-large.png",
              classes: "xv-relationwidget-icon"},
            {name: 'popupMenu', floating: true, kind: "onyx.Menu",
              components: [
              {kind: "XV.MenuItem", name: 'searchItem', content: "_search".loc()},
              {kind: "XV.MenuItem", name: 'openItem', content: "_open".loc(),
                disabled: true},
              {kind: "XV.MenuItem", name: 'newItem', content: "_new".loc(),
                disabled: true}
            ]}
          ]},
          {name: "completer", kind: "XV.Completer"}
        ]}
      ]},
      {name: "name", classes: "xv-relationwidget-description"},
      {name: "description", classes: "xv-relationwidget-description"}
    ],
    /**
     @todo Document the autocomplete method.
     */
    autocomplete: function () {
      var key = this.getKeyAttribute(),
        attr = this.getValue() ? this.getValue().get(key) : "",
        value = this.$.input.getValue(),
        query;

      if (value && value !== attr) {
        query = {
          parameters: [{
            attribute: key,
            operator: "BEGINS_WITH",
            value: value
          }],
          rowLimit: 1,
          orderBy: [{
            attribute: key
          }]
        };
        this._collection.fetch({
          success: enyo.bind(this, "_fetchSuccess"),
          query: query
        });
      } else if (!value) {
        this.setValue(null);
      }
    },
    /**
     @todo Document the clear method.
     */
    clear: function (options) {
      this.setValue(null, options);
    },
    /**
     @todo Document the create method.
     */
    create: function () {
      this.inherited(arguments);
      this.listChanged();
      this.labelChanged();
      this.disabledChanged();
    },
    /**
     @todo Document the disabledChanged method.
     */
    disabledChanged: function () {
      var disabled = this.getDisabled();
      this.$.input.setDisabled(disabled);
      this.$.name.addRemoveClass("disabled", disabled);
      this.$.description.addRemoveClass("disabled", disabled);
    },
    /**
     @todo Document the focus method.
     */
    focus: function () {
      this.$.input.focus();
    },
    /**
     @todo Document the getValueToString method.
     */
    getValueToString: function () {
      return this.value.get(this.getKeyAttribute());
    },
    /**
     @todo Revisit or remove after ENYO-1104 is resolved.
     */
    keyDown: function (inSender, inEvent) {
      // XXX hack here (and in other places that reference issue 18397)
      // can be removed once enyo fixes ENYO-1104
      var shadowNone = inEvent.originator.hasClass("text-shadow-none");
      inEvent.originator.addRemoveClass("text-shadow-none", !shadowNone);
      inEvent.originator.addRemoveClass("text-shadow-0", shadowNone);
      // end hack

      // If tabbed out...
      inEvent.activator = this.$.decorator;
      if (inEvent.keyCode === 9) {
        this.$.completer.waterfall("onRequestHideMenu", inEvent);
        this.autocomplete();
      }
    },
    /**
     @todo Document the keyUp method.
     */
    keyUp: function (inSender, inEvent) {
      var query,
        key = this.getKeyAttribute(),
        attr = this.getValue() ? this.getValue().get(key) : "",
        value = this.$.input.getValue(),
        completer = this.$.completer;
      inEvent.activator = this.$.decorator;

      // Look up if value changed
      if (value && value !== attr &&
          inEvent.keyCode !== 9) {
        query = {
          parameters: [{
            attribute: key,
            operator: "BEGINS_WITH",
            value: value
          }],
          rowLimit: 10,
          orderBy: [{
            attribute: key
          }]
        };
        this._collection.fetch({
          success: enyo.bind(this, "_collectionFetchSuccess"),
          query: query
        });
      } else {
        completer.waterfall("onRequestHideMenu", inEvent);
      }
    },
    /**
     @todo Document the itemSelected method.
     */
    itemSelected: function (inSender, inEvent) {
      if (inEvent.originator.kind === 'onyx.MenuItem') {
        this.relationSelected(inSender, inEvent);
      } else {
        this.menuItemSelected(inSender, inEvent);
      }
      return true;
    },
    /**
     @todo Document the labelChanged method.
     */
    labelChanged: function () {
      var label = (this.getLabel() || ("_" + this.attr || "").loc());
      this.$.label.setContent(label + ":");
    },
    /**
     @todo Document the listChanged method.
     */
    listChanged: function () {
      var list = this.getList(),
        Collection,
        workspace;
      delete this._List;
      delete this._Workspace;

      // Get List class
      if (!list) { return; }
      this._List = XT.getObjectByName(list);

      // Get Workspace class
      workspace = this._List.prototype.getWorkspace();
      this._Workspace = workspace ? XT.getObjectByName(workspace) : null;

      // Setup collection instance
      Collection = this.getCollection() ?
        XT.getObjectByName(this.getCollection()) : null;
      if (!Collection) { return; }
      this._collection = new Collection();
    },
    /**
     @todo Document the menuItemSelected method.
     */
    menuItemSelected: function (inSender, inEvent) {
      var that = this,
        menuItem = inEvent.originator,
        list = this.getList(),
        model = this.getValue(),
        id = model ? model.id : null,
        workspace = this._List ? this._List.prototype.getWorkspace() : null,
        callback;
      switch (menuItem.name)
      {
      case 'searchItem':
        callback = function (value) {
          that.setValue(value);
        };
        this.doSearch({
          list: list,
          searchText: this.$.input.getValue(),
          callback: callback
        });
        break;
      case 'openItem':
        this.doWorkspace({
          workspace: workspace,
          id: id,
          allowNew: false
        });
        break;
      case 'newItem':
        // Callback options on commit of the workspace
        // Find the model with matching id, fetch and set it.
        callback = function (model) {
          var Model = that._collection.model,
            value = new Model({id: model.id}),
            options = {};
          options.success = function () {
            that.setValue(value);
          };
          value.fetch(options);
        };
        this.doWorkspace({
          workspace: workspace,
          callback: callback,
          allowNew: false
        });
        break;
      }
    },
    /**
     @todo Document the modelChanged method.
     */
    modelChanged: function (inSender, inEvent) {
      var that = this,
        List = this._List,
        workspace = List.prototype.getWorkspace(),
        Workspace = workspace ? XT.getObjectByName(workspace) : null,
        options = {},
        model = this.getValue();
      // If the model that changed was related to and exists on this widget
      // refresh the local model.
      if (!List || !Workspace || !model) { return; }
      if (Workspace.prototype.model === inEvent.model &&
        model.id === inEvent.id) {
        options.success = function () {
          that.setValue(model);
        };
        model.fetch(options);
      }
    },
    /**
     @todo Document the placeholderChanged method.
     */
    placeholderChanged: function () {
      var placeholder = this.getPlaceholder();
      this.$.input.setPlaceholder(placeholder);
    },
    /**
     @todo Document the receiveBlur method.
     */
    receiveBlur: function (inSender, inEvent) {
      this.autocomplete();
      this._hasFocus = false;
    },
    /**
     @todo Document the receiveFocus method.
     */
    receiveFocus: function (inSender, inEvent) {
      this._hasFocus = true;
      this._relationSelected = false;
    },
    /**
     @todo Document the relationSelected method.
     */
    relationSelected: function (inSender, inEvent) {
      this._relationSelected = true;
      inEvent.activator = this.$.decorator;
      this.setValue(inEvent.originator.model);
      this.$.completer.waterfall("onRequestHideMenu", inEvent);
      return true;
    },
    /**
      Programatically sets the value of this widget.

      @param value Can be a model or the id of a model (String or Number).
        If it is an ID, then the correct model will be fetched and this
        function will be called again recursively with the model.
      @param options {Object}
     */
    setValue: function (value, options) {
      options = options || {};
      var that = this,
        newId = value ? value.id : null,
        oldId = this.value ? this.value.id : null,
        key = this.getKeyAttribute(),
        name = this.getNameAttribute(),
        descrip = this.getDescripAttribute(),
        inEvent = { value: value, originator: this },
        keyValue = "",
        nameValue = "",
        descripValue = "",
        Workspace = this._Workspace,
        Model = Workspace && Workspace.prototype.model ?
          XT.getObjectByName(Workspace.prototype.model)  : null,
        originalValue,
        couldNotCreate = Model ? !Model.canCreate() : true,
        setPrivileges = function () {
          if (value && newId) {
            that.$.openItem.setDisabled(!value.couldRead());
          }
        };

      // Here is where we find the model and re-call this method if we're given
      // an id instead of a whole model.
      if (_.isNumber(value) || _.isString(value)) {
        if (this.value === value || oldId === value) { return; }
        originalValue = value;
        Model = XT.getObjectByName(this._collection.model.prototype.recordType);
        value = new Model();
        options = {
          id: originalValue,
          success: function () {
            that.setValue(value);
          },
          error: function () {
            X.log("Error setting relational widget value");
          }
        };
        value.fetch(options);
        return;
      }

      this.value = value;
      if (value && value.get) {
        keyValue = value.get(key) || "";
        nameValue = value.get(name) || "";
        descripValue = value.get(descrip) || "";
      }
      this.$.input.setValue(keyValue);
      this.$.name.setShowing(nameValue);
      this.$.name.setContent(nameValue);
      this.$.description.setShowing(descripValue);
      this.$.description.setContent(descripValue);

      // Only notify if selection actually changed
      if (newId !== oldId && !options.silent) { this.doValueChange(inEvent); }

      // Handle menu actions
      that.$.openItem.setShowing(Workspace);
      that.$.newItem.setShowing(Workspace);
      that.$.openItem.setDisabled(true);
      that.$.newItem.setDisabled(couldNotCreate);
      if (Model && Workspace) {
        if (XT.session) {
          setPrivileges();
        } else {
          XT.getStartupManager().registerCallback(setPrivileges);
        }
      }
    },
    /** @private */
    _collectionFetchSuccess: function () {
      if (!this._hasFocus) { return; }
      var key = this.getKeyAttribute(),
        value = this.$.input.getValue(),
        models = this._collection.models,
        inEvent = { activator: this.$.decorator };
      if (models.length) {
        this.$.completer.buildList(key, value, models);
        if (!this.$.completer.showing) {
          this.$.completer.waterfall("onRequestShowMenu", inEvent);
        }
        this.$.completer.adjustPosition();
      } else {
        this.$.completer.waterfall("onRequestHideMenu", inEvent);
      }
    },
    /** @private */
    _fetchSuccess: function () {
      if (this._relationSelected) { return; }
      var value = this._collection.length ? this._collection.models[0] : null,
        target = enyo.dispatcher.captureTarget;
      this.setValue(value);
      enyo.dispatcher.captureTarget = target;
    }

  });
}());
