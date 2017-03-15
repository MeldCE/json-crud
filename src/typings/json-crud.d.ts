export = JsonDB;

declare function JsonDB(path?: string; options?: Options): Promise<JsonDBInstance>;

declare namespace JsonDB {

  export type Id = string | number;

  export type Results = { [key: Id]: any };

  export type Data = any[];

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
     * Create a new value in the database, optionally replace any existing
     * values with the same Id
     *
     * @param [replace] Replace any values with the Ids specified. If falsey,
     *   the create will reject if there is an id conflict
     * @param [...data] Data to insert into the database.
     *
     * @returns A promise resolving to an array of the Ids of the values
     *   created
     */
    create: (replace?: boolean; ...data: Data) => Promise<Id[]>;
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
     * Updates the values in the database
     *
     * @param [...data] Data to update into the database.
     *
     * @returns A promise resolving to an array of the Ids of the values
     *   updated
     */
    update: (...data: Data) => Promise<Id[]>;
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
