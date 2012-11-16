/*jshint indent:2, curly:true eqeqeq:true, immed:true, latedef:true,
newcap:true, noarg:true, regexp:true, undef:true, trailing:true
white:true*/
/*global enyo:true, XM:true, XV:true, XT:true, _:true */


(function () {

  /**
   @class An assignment box is a groupbox that manages the assignment of a set of
   available options to an object. For example, setting up the privileges that
   are associated with a role.
   @name XV.AssignmentBox
   @extends XV.ScrollableGroupbox
   */
  enyo.kind(/** @lends XV.AssignmentBox# */{
    name: "XV.AssignmentBox",
    kind: "XV.Groupbox",
    classes: "xv-assignment-box",
    handlers: {
      onValueChange: "checkboxChange"
    },

    /**
     * Published fields
     * @type {Object}
     *
     * @property {XM.Collection} assignedCollection
     * The collection that backs this box. The model of the collection is the
     *    assignment (link) model.
     *
     * @property {Array} assignedIds
     * The ids of the assignable models. Cached for performance and recached whenever
     *    the assignedCollection is changed.
     *
     * @property {String} cacheName
     * The name of the cached collection if the collection is stored in the XM cache.
     *
     * @property {Array} restrictedValues
     * An array of the values that we want to see in this assignment box. Values not in
     *    this array will be suppressed. If this is null (as by default) then no suppression
     *    will occur.
     *
     * @property {Array} segmentedCollections
     * An array of collections, each of whom are a subset of totalCollection.
     *
     * @property {Array} segments
     * We allow the assignable checkboxes to be grouped by segment, such as module.
     *    If this array is length one then there is no segmentation, and the one value
     *    of the array becomes the header of the box.
     *
     * @property {String} title
     * Used by the workspace to title the menu item for the box.
     *
     * @property {XM.Collection} totalCollection
     * The collection of all possible assignable models.
     *
     * @property {String} totalCollectionName
     * The name in the the XM namespace of the collection. Used to making new
     * segmentedCollections.
     *
     * @property {Boolean} translateLabels
     * We want to translate the labels if they are hardcoded into our system (such as privileges)
     *    but not if they are user-defined.
     *
     * @property {String} type
     * Camelized name of assignable model. Used for drilling down from the assignment
     *    (link) model to the assignable model.
     */
    published: {
      assignedCollection: null,
      assignedIds: null,
      cacheName: "",
      restrictedValues: null,
      segmentedCollections: null,
      segments: null,
      title: "",
      totalCollection: null,
      totalCollectionName: "",
      translateLabels: true,
      type: ""
    },

    components: [
      {kind: "onyx.GroupboxHeader", name: "masterHeader"},
      {kind: "Scroller", fit: true, horizontal: "hidden", components: [
        {kind: "Repeater", name: "segmentRepeater", fit: true, onSetupItem: "setupSegment", segmentIndex: 0, components: [
          {kind: "onyx.GroupboxHeader", name: "segmentHeader", content: ""},
          {kind: "Repeater", name: "checkboxRepeater", fit: true, onSetupItem: "setupCheckbox", components: [
            {kind: "XV.CheckboxWidget", name: "checkbox" }
          ]}
        ]}
      ]}
    ],
    /**
     * Applies special formatting to a checkbox after it has been clicked, if applicable.
     * This method should be overriden by the subkind if applicable.
     */
    applyPostCheckFormatting: function (checkbox, model) {
    },
    /**
     * Makes sure that the assignedIds field is kept in synch with the assignedCollection field
     */
    assignedCollectionChanged: function () {
      this.mapIds();
    },
    /**
     * Handles bubbled checkbox event changes and prevents them from bubbling further.
     */
    checkboxChange: function (inSender, inEvent) {
      var that = this,
        checkbox = inEvent.originator,
        originatorName = checkbox.name,
        value = inEvent.value,
        checkedModel,
        newModel;

      //
      // The record type in totalCollection is XM.Privilege and the
      // record type in assignedCollection is XM.UserAccountPrivilegeAssignment,
      // so we have to navigate this.
      //
      if (value) {
        // filter returns an array and we want a model: that's why I [0]
        // assumption: no duplicate originator names
        checkedModel = _.filter(this.getTotalCollection().models, function (model) {
          return model.get("name") === originatorName;
        })[0];
        newModel = this.getAssignmentModel(checkedModel);
        this.getAssignedCollection().add(newModel);

      } else {
        checkedModel = _.filter(this.getAssignedCollection().models, function (model) {
          // we don't want to redestroy a destroyed model, because there's probably a living one
          // behind it that actually is the one to destroy
          return !(model.getStatus() & XM.Model.DESTROYED) &&
            model.get(that.getType()) &&
            model.get(that.getType()).get("name") === originatorName;
        })[0];
        if (!checkedModel) {
          XT.log("No model to destroy. This is probably a bug."); // XXX
        }
        checkedModel.destroy();
      }

      // force a refresh of the mapIds cache
      this.assignedCollectionChanged();
      this.tryToRender();
      this.applyPostCheckFormatting(checkbox, checkedModel);
      return true;
    },

    /**
     * Populates totalCollection field (either from the cache or through a fetch)
     * and calls for the totalCollection to be segmentized.
     */
    create: function () {
      var i,
        that = this,
        comparator = function (model) {
          return model.get("name");
        };

      this.inherited(arguments);

      this.$.masterHeader.setContent(this.getTitle());
      this.setSegmentedCollections([]);

      for (i = 0; i < this.getSegments().length; i++) {
        this.getSegmentedCollections()[i] = new XM[this.getTotalCollectionName()]();
        this.getSegmentedCollections()[i].comparator = comparator;
      }
      //
      // Get the collection from the cache if it exists
      //
      if (XM[this.getCacheName()]) {
        this.setTotalCollection(XM[this.getCacheName()]);
        this.segmentizeTotalCollection();
      } else {
        this.setTotalCollection(new XM[this.getTotalCollectionName()]());
        var options = {success: function () {
          that.segmentizeTotalCollection();
        }};
        this.getTotalCollection().fetch(options);
      }
    },
    /**
     * Creates a new assignment model to add to the assignedCollection.
     * We rely on the subkinds to override this function, as implemetations are varied.
     */
    getAssignmentModel: function () {
      return null;
    },

    /**
     * Updates the cache of assignedIds based on the assignedCollection.
     */
    mapIds: function () {
      var that = this;

      this.setAssignedIds(this.getAssignedCollection().map(function (model) {
        if (!model.get(that.getType())) {
          // I have seen cases where assignments point to models that don't exist.
          // So ignore these. XXX should I return -9999 instead of null? I'd hate
          // for there to be nulls in there that might somehow get "matched up on"
          // by null checkboxes somehow.
          return null;
        }

        if (model.getStatus() & XM.Model.DESTROYED) {
          // don't add destroyed models to cache
          return null;
        }
        return model.get(that.getType()).get("id");
      }));
    },
    /**
     * Called by the segmentRepeater. Sets the header of the segment and awakens
     * the checkboxRepeater.
     */
    setupSegment: function (inSender, inEvent) {
      var index = inEvent.index,
        row = inEvent.item,
        header = row.$.segmentHeader;

      if (inEvent.originator.name !== 'segmentRepeater') {
        // not sure why the checkbox repeater is bringing us here, but ignore
        // the return true at the bottom of setupCheckbox should have fixed this
        return;
      }

      inSender.segmentIndex = index;

      if (header && (this.getSegments().length < 2 || this.getSegmentedCollections()[index].length === 0)) {
        //
        // Suppress the header if there's just one segment, or if the segment is empty of boxes to assign
        //
        header.parent.removeChild(header);

      } else if (header) {
        header.setContent(("_" + this.getSegments()[index]).loc());
      }

      row.$.checkboxRepeater.setCount(this.getSegmentedCollections()[index].length);

      return true;
    },
    /**
     * Sets up a checkbox: label, value, checkiness.
     */
    setupCheckbox: function (inSender, inEvent) {
      var index = inEvent.item.indexInContainer(), //inEvent.index,
        parentSegmentRepeater = inSender.parent.parent,
        segmentIndex = parentSegmentRepeater.segmentIndex,
        data = this.getSegmentedCollections()[segmentIndex].at(index),
        row = inEvent.item.$.checkbox,
        title = data.get("name").camelize(),
        label = this.getTranslateLabels() ? ("_" + title).loc() : data.get("name");

      // XXX useful for translating:
      //console.log('"_' + title + '": "' + data.get("name") + '",');
      row.setLabel(label);
      row.setName(data.get("name"));
      if (_.indexOf(this.getAssignedIds(), data.get("id")) >= 0) {
        row.setValue(true, { silent: true });
      }
      return true;
    },
    /**
     * This is the method that the parent container will typically call to
     * create this box. All logic and rendering flows from here.
     */
    setValue: function (value) {
      this.setAssignedCollection(value);
      /*
       * We wait to do this until we have the granted collection
       */
      this.tryToRender();
    },

    segmentizeTotalCollection: function () {
      var i, model, name;
      for (i = 0; i < this.getTotalCollection().length; i++) {
        model = this.getTotalCollection().models[i];
        name = model.get("name")
        if (!this.getRestrictedValues() || this.getRestrictedValues().indexOf(name) >= 0) {
          // note: multiple segment support is effectively disabled by the hardcoded 0, below.
          // if we want to re-incorporate it, look at the commented implementation below
          // for a flavor of how this might work.
          this.getSegmentedCollections()[0].add(model);
        }
      }
      this.tryToRender();
    },

    // old implementation:
    //segmentizeTotalCollection: function () {
    //  var i, j, model, module;
    //  for (i = 0; i < this.getTotalCollection().length; i++) {
    //    model = this.getTotalCollection().models[i];
    //    module = model.get("module");
    //    for (j = 0; j < this.getSegments().length; j++) {
    //      if (this.getSegments().length === 1 || module.toLowerCase() === this.getSegments()[j].toLowerCase()) {
    //        // if there's only one segment then no need to segmentize at all
    //        this.getSegmentedCollections()[j].add(model);
    //      }
    //    }
    //  }
    //  this.tryToRender();
    //},

    /**
     * Render this AssignmentBox by firing off the segment repeater.
     * We can only render if we know *both* what the options and and also
     * what's already assigned. These both can happen asynchronously,
     * which is why we have to check and only execute when both are done.
     */
    tryToRender: function () {
      if (this.getAssignedCollection() && this.getSegmentedCollections()[0]) {
        this.$.segmentRepeater.setCount(this.getSegments().length);
      }
    }
  });
}());
