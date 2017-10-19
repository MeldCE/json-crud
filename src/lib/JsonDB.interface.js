module.exports = {
  type: {
    create: {
      doc: {
        doc: 'Creates a bew item in the database',
        parameters: {
          replace: {
            doc: 'Whether or not a existing record should be replaced. If false, an error will be thrown if an item with the same id already exists',
            type: 'boolean'
          },
          id: {
            doc: 'String identifier for the new item. Must only be set if no id field is specified in the options.',
            type: 'string'
          },
          data: {
            doc: 'Data for the new item',
            type: 'any',
            required: true
          }
        },
        returns: {
          doc: 'A Promise that will resolve to the id of the item created',
          type: 'Promise'
        }
      },
      type: 'function',
      required: true
    },
    set: {
      doc: 'Synonum for create function',
      type: 'function',
      required: true
    },
    replace: {
      doc: {
        doc: 'Synanom for create with overwrite set to true',
        parameters: {
          id: {
            doc: 'String identifier for the new item. Must only be set if no id field is specified in the options.',
            type: 'string'
          },
          data: {
            doc: 'Data for the new item',
            type: 'any',
            required: true
          }
        },
        returns: {
          doc: 'A Promise that will resolve to the id of the item created '
              + 'and whether or not a item existed previously',
          type: 'Promise'
        }
      },
      type: 'function',
      required: true
    },
    read: {
      doc: {
        doc: 'Retrieves an item / items from the database',
        parameters: {
          filter: {
            doc: 'Data for the new item',
            type: {
            },
            multiple: true,
            object: true,
            required: true
          },
          expectOne: {
            doc: 'Whether or not a single record is expect',
            type: 'boolean'
          }
        },
        returns: {
          doc: 'A promise that returns to the items that matched the filter',
          type: 'Promise'
        }
      },
      type: 'function',
      required: true
    },
    get: {
      doc: 'Synanom for read',
      type: 'function',
      required: true
    },
    update: {
      doc: {
        doc: 'Updates an existing record. If the existing and new values are Objects, they will be merged',
        parameters: {
          id: {
            doc: 'String identifier for the new item. Must only be set if no id field is specified in the options.',
            type: 'string'
          },
          data: {
            doc: 'Data for the new item',
            required: true
          }
        }
      },
      type: 'function',
      required: true
    },
    delete: {
      doc: {
        doc: 'Creates a bew item in the database'
      },
      type: 'function',
      required: true
    }
  }
};

module.exports.type.delete.doc.parameters = module.exports.type.read.doc.parameters;

