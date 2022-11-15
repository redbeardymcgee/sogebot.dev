import "reflect-metadata"
import { DataSource } from "typeorm"
import { Plugin } from "./entity/Plugin"
import { PluginVote } from "./entity/PluginVote"

const migrationDir = process.env.ENV === 'production' ? 'build' : 'src'

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.PG_HOST || "localhost",
    port: Number(process.env.PG_PORT) || 5432,
    username: process.env.PG_USERNAME || "postgres",
    password: process.env.PG_PASSWORD || "postgres",
    database: process.env.PG_DB || "sogebot",
    logging: false,
    entities: [Plugin, PluginVote],
    migrations: [`./${migrationDir}/migration/*`],
    subscribers: [],
    synchronize: false,
    migrationsRun: !process.env.CLUSTER,
})