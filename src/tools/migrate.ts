import {Database, Env} from '../modules/database';
import fs from 'node:fs';
import path from 'node:path';

const SRCDIR = "../";
const ROOT = path.basename(path.join(SRCDIR, '../'));
console.log("ROOT ", ROOT);
const MIGRATIONS = path.join(ROOT, '/src', "/migrations");
const ROLLBACKS = path.join(ROOT, '/src', "/rollbacks");
console.log(MIGRATIONS, ROLLBACKS)

console.log("Running migrations...");
const db = new Database(Env.KEYSTOREDB);

const GPGKEYS = "gpg_keys.sql";
const GPGSUBKEYS = "gpg_subkeys.sql";
const GPGFETCHLOGS = "gpg_fetch_logs.sql";
const GPGUSERIDS = "gpg_user_ids.sql";

db.sqlloadfile(path.basename(path.join(MIGRATIONS, GPGKEYS)))
