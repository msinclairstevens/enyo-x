/*jshint bitwise:true, indent:2, curly:true eqeqeq:true, immed:true,
latedef:true, newcap:true, noarg:true, regexp:true, undef:true,
trailing:true white:true*/
/*global XT:true, XM:true, XV:true, _:true, enyo:true, Globalize:true*/

(function () {

  var ROWS_PER_FETCH = 50;
  var FETCH_TRIGGER = 100;

  /**
    @class
    @name XV.ListItem
    @see XV.List
   */
  enyo.kind(/** @lends XV.ListItem# */{
    name: "XV.ListItem",
    classes: "xv-list-item",
    ontap: "itemTap",
    setSelected: function (inSelected) {
      this.addRemoveClass("item-selected", inSelected);
    }
  });

  /**
    @class
    @name XV.ListColumn
    @see XV.List
   */
  enyo.kind(/** @lends XV.ListColumn# */{
    name: "XV.ListColumn",
    classes: "xv-list-column"
  });

  /**
    @class
    @name XV.ListAttr
    @see XV.List
   */
  enyo.kind(/** @lends XV.ListAttr# */{
    name: "XV.ListAttr",
    classes: "xv-list-attr",
    published: {
      attr: ""
    }
  });

  /**
    @class Displays a scrolling list of rows. 
    Handles lazy loading. Passes in the first 50 items, and as one scrolls, passes more.
    Note: enyo.list includes a scroller; therefore, XV.List should not be placed inside a scroller.
    @class
    @name XV.List
    @see XV.ListItem
    @see XV.ListColumn
    @see XV.ListAttr
   */
  enyo.kind(/** @lends XV.List# */{
    name: "XV.List",
    kind: "List",
    classes: "xv-list",
    /**
     * Published fields
     * @type {Object}
     *
     * @property {Boolean} canAddNew
     *
     * @property {Number} fetchCount
     *   Represents the number of times this list has been fetched on. Useful for
     *   correctly ordering asynchronous responses.
     * @property {String} label
     */
    published: {
      label: "",
      collection: null,
      fetchCount: 0,
      filterDescription: "",
      query: null,
      isFetching: false,
      isMore: true,
      parameterWidget: null,
      canAddNew: true,
      value: null
    },
    events: {
      onItemTap: "",
      onWorkspace: ""
    },
    fixedHeight: true,
    handlers: {
      onModelChange: "modelChanged",
      onSetupItem: "setupItem"
    },
    /**
     @todo Document the collectionChanged method.
     */
    collectionChanged: function () {
      var collection = this.getCollection(),
        Klass = collection ? XT.getObjectByName(collection) : false;

      if (Klass) {
        this.setValue(new Klass());
      } else {
        this.setValue(null);
      }
    },
    /**
     @todo Document the create method.
     */
    create: function () {
      this.inherited(arguments);
      this.collectionChanged();
    },
    /**
     @todo Document the getModel method.
     */
    getModel: function (index) {
      return this.getValue().models[index];
    },
    /**
     @todo Document the getSearchableAttributes method.
     */
    getSearchableAttributes: function () {
      var model = this.getValue().model;
      return model.getSearchableAttributes ? model.getSearchableAttributes() : [];
    },
     /**
      @todo Document the getWorkspace method.
      */
    getWorkspace: function () {
      var collection = this.getCollection(),
        Klass = collection ? XT.getObjectByName(collection) : null,
        recordType = Klass ? Klass.prototype.model.prototype.recordType : null;
      return XV.getWorkspace(recordType);
    },
    /**
     @todo Document the fetch method.
     */
    fetch: function (options) {
      var that = this,
        query = this.getQuery() || {},
        success,
        fetchIndex = this.getFetchCount() + 1;

      this.setFetchCount(fetchIndex);

      options = options ? _.clone(options) : {};
      options.showMore = _.isBoolean(options.showMore) ?
        options.showMore : false;
      success = options.success;

      // Lazy Loading
      if (options.showMore) {
        query.rowOffset += ROWS_PER_FETCH;
        options.add = true;
      } else {
        query.rowOffset = 0;
        query.rowLimit = ROWS_PER_FETCH;
      }

      _.extend(options, {
        success: function (resp, status, xhr) {
          if (fetchIndex < that.getFetchCount()) {
            // this is an earlier query that's been running so long
            // that a more recent query has already been called. Do not
            // process or render.
            return;
          }
          that.fetched();
          if (success) { success(resp, status, xhr); }
        },
        query: query
      });
      this.getValue().fetch(options);
    },
    /**
     @todo Document the fetched method.
     */
    fetched: function () {
      var query = this.getQuery() || {},
        offset = query.rowOffset || 0,
        limit = query.rowLimit || 0,
        count = this.getValue().length,
        isMore = limit ?
          (offset + limit <= count) && (this.getCount() !== count) : false,
        rowsPerPage;
      this.isMore = isMore;
      this.fetching = false;

      // Reset the size of the list
      this.setCount(count);

      // Hack: Solves scroll problem for small number of rows
      // but doesn't seem quite right
      rowsPerPage = count && 50 > count ? count : 50;
      if (rowsPerPage !== this.rowsPerPage) {
        this.setRowsPerPage(rowsPerPage);
      }
      if (offset) {
        this.refresh();
      } else {
        this.reset();
      }
      this._maxTop = this.getScrollBounds().maxTop;
    },
    /**
     @todo Document the itemTap method.
     */    
    itemTap: function (inSender, inEvent) {
      inEvent.list = this;
      this.doItemTap(inEvent);
    },
    /**
      When a model changes, we are notified. We check the list to see if the
      model is of the same recordType. If so, we check to see if the newly
      changed model should still be on the list, and refresh appropriately.
     */
    modelChanged: function (inSender, inEvent) {
      var that = this,
        workspace = this.getWorkspace(),
        model,
        Klass = XT.getObjectByName(this.getCollection()),
        checkStatusCollection,
        checkStatusParameter,
        checkStatusQuery;

      // If the model that changed was related to and exists on this list
      // refresh the item. Remove the item if appropriate
      workspace = workspace ? XT.getObjectByName(workspace) : null;
      if (workspace && workspace.prototype.model === inEvent.model &&
          this.getValue() && typeof Klass === 'function') {
        model = this.getValue().get(inEvent.id);

        // cleverness: we're going to see if the model still belongs in the collection by
        // creating a new query that's the same as the current filter but with the addition
        // of filtering on the id. Any result means it still belongs. An empty result
        // means it doesn't.

        // clone the query so as not to change the real thing with this check.
        checkStatusQuery = JSON.parse(JSON.stringify(this.getQuery()));
        checkStatusParameter = {attribute: "id", operator: "=", value: inEvent.id};
        if (checkStatusQuery.parameters) {
          checkStatusQuery.parameters.push(checkStatusParameter);
        } else {
          checkStatusQuery.parameters = [checkStatusParameter];
        }

        checkStatusCollection = new Klass();
        checkStatusCollection.fetch({
          query: checkStatusQuery,
          success: function (collection, response) {
            // remove the old model no matter the query result
            if (model) {
              that.getValue().remove(model);
            }

            if (response.length > 0) {
              // this model should still be in the collection. Refresh it.

              that.getValue().add(response[0], {silent: true});
            }
            if (that.getCount() !== that.getValue().length) {
              that.setCount(that.getValue().length);
            }
            that.refresh();
          },
          error: function (collection, error) {
            XT.log("Error checking model status in list");
          }
        });
      }
    },
    /**
      Makes sure the collection can handle the sort order
      defined in the query.
    */
    queryChanged: function () {
      var query = this.getQuery();
      if (this.getValue() && query.orderBy) {
        this.getValue().comparator = function (a, b) {
          var aval,
            bval,
            attr,
            numeric,
            descending,
            i;
          for (i = 0; i < query.orderBy.length; i++) {
            attr = query.orderBy[i].attribute;
            numeric = query.orderBy[i].numeric;
            descending = query.orderBy[i].descending;
            aval = query.orderBy[i].descending ? b.getValue(attr) : a.getValue(attr);
            bval = query.orderBy[i].descending ? a.getValue(attr) : b.getValue(attr);
            aval = numeric ? aval - 0 : aval;
            bval = numeric ? bval - 0 : bval;
            if (aval !== bval) {
              return aval > bval ? 1 : -1;
            }
          }
          return 0;
        };
      }
    },
     /**
      Manages lazy loading of items in the list.
      */
    scroll: function (inSender, inEvent) {
      var r = this.inherited(arguments),
        options = {},
        max;
      if (!this._maxTop) { return r; }

      // Manage lazy loading
      max = this._maxTop - this.rowHeight * FETCH_TRIGGER;
      if (this.isMore && !this.fetching && this.getScrollPosition() > max) {
        this.fetching = true;
        options.showMore = true;
        this.fetch(options);
      }

      return r;
    },
     /**
      @todo Document the setupItem method.
      */
    setupItem: function (inSender, inEvent) {
      var model = this.getValue().models[inEvent.index],
        prop,
        isPlaceholder,
        view,
        value,
        formatter,
        attr;

      // Loop through all attribute container children and set content
      for (prop in this.$) {
        if (this.$.hasOwnProperty(prop) && this.$[prop].getAttr) {
          view = this.$[prop];
          isPlaceholder = false;
          attr = this.$[prop].getAttr();
          value = model.getValue ? model.getValue(attr) : model.get(attr);
          formatter = view.formatter;
          if (!value && view.placeholder) {
            value = view.placeholder;
            isPlaceholder = true;
          }
          view.addRemoveClass("placeholder", isPlaceholder);
          if (formatter) {
            value = this[formatter](value, view, model);
          }
          if (value && value instanceof Date) {
            value = XT.date.applyTimezoneOffset(value, true);
            value = Globalize.format(value, 'd');
          }
          view.setContent(value);
        }
      }
      return true;
    },
     /**
      @todo Document the setQuery method.
      */
    setQuery: function () {
      var old = _.clone(this.query);
      this.inherited(arguments);
      // Standard call doesn't do deep comparison
      if (_.isEqual(old, this.query)) {
        this.queryChanged();
      }
    }
  });

}());
