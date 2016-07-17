/// <reference types="bluebird" />
import * as Bluebird from 'bluebird';

export interface CCOptions {
    member?: string;
    debug?: boolean;
    throws?: boolean;
}

export declare class ChainCommander {
    constructor(defs: any, options?: CCOptions);
    execute<T>(obj: T, context: any): Bluebird<T>;
    static all<T>(obj: T, defs: any[], context: Object, tap?: (obj: T, ...args: any[]) => void): Bluebird<T>;
}

export default (bb: any) => typeof ChainCommander;

