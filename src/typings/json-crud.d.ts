export = JsonDB;

declare function JsonDB(path?: string; options?: Options): Promise<JsonDBInstance>;

declare namespace JsonDB {

  export type Id = string | number;

  export type IdOrError = Id | Error;

  export type Results = { [key: Id]: any };

  export type Data = { [key: Id]: any } | any[];

  export type FieldFilter =
    /// Matches values that are equal to a specified value.
    { $eq: any }
    /// Matches values that are greater than a specified value.
    | { $gt: any }
    /// Matches values that are greater than or equal to a specified value.
    | { $gte: any }
    /// Matches values that are less than a specified value.
    | { $lt: any }
    /// Matches values that are less than or equal to a specified value.
    | { $lte: any }
    /// Matches all values that are not equal to a specified value.
    | { $ne: any }
    /// Matches any of the values specified in an array.
    | { $in: any[] }
    /// Matches none of the values specified in an array.
    | { $nin: any[] };

  export type Filter = Id | Id[] | {
    /// Field value comparison
    [field: string]: FieldFilter | any,
    /// Logical AND
    $and?: Filter[],
    /// Logical OR
    $or?: Filter[],
    /// Logical NOT
    $not?: Filter,
  };

  export interface JsonDBInstance {
    /**
     * Inserts data into the JSON database.
     *
     * @param data Either an object of key-value pairs, an array
     *   containing key/value pairs ([key, value,...]) or, if the key field has
     *   been specified, an array of object values each with the key field set
     *
     * @returns {Promise} A promise that will resolve with an array containing
     *   keys or errors in creating the data of the inserted data.
     */
    create: (data: Data) => Promise<IdOrError[]>;
    /**
     * Retrieve values from the database
     *
     * @param [filter] Filter to use to match the values to return. If not
     *   given, all values will be returned
     *
     * @returns A promise that will resolve to an object containing the
     *   key/values of the values matched
     */
    read: (filter?: Filter) => Promise<Results>;
    /**
     * Updates data in the JSON database. Data can either be given as
     * key-value parameter pairs, OR if the key field has been specified Object
     * values. New values will be merge into any existing values.
     *
     * @param data Either:
     *   - an array of key-value pairs,
     *   - an array of object value(s) containing the key value (if a key has
     *     been specified)
     * @param filter true if the existing items should be replaced
     *   instead of or false to merge existing values (if values are mergeable)
     *
     * @returns {Promise} A promise that will resolve with an array containing
     *   keys of the updated data.
     */
    update: (data: Data, filter: boolean) => Promise<IdOrError[]>;
    /**
     * Updates data in the JSON database. Data can either be given as
     * key-value parameter pairs, OR if the key field has been specified Object
     * values. New values will be merge into any existing values.
     *
     * @param data Property values to update of any objects that
     *   match the given filter
     * @param [filter] A filter to select the items that
     *   should be updated
     *
     * @returns {Promise} A promise that will resolve with an array containing
     *   keys of the updated data.
     */
    update: (data: { [ property: string]: any }, filter: Filter) => Promise<IdOrError[]>;
    /**
     * Deletes values from the database
     *
     * @param [filter] Filter to use to match the values to delete. If true
     *   all values will be deleted
     *
     * @returns A promise resolving to an array of the Ids of the values
     *   deleted
     */
    delete: (filter: Filter | true) => Promise;
    /**
     * Closes the CRUD database instance
     */
    close: () => void;
  };

  export interface Options {
    /// Path to file/folder to contain JSON database
    path: string;
    /// Field of data objects to be used as the key for the object
    id: string;
    /// Cache keys of the values in the database
    cacheKeys: boolean;
    /// Cache the values in the database
    cacheValues: boolean;
  };
};
