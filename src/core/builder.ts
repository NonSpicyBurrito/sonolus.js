import {
    compressSync,
    EngineConfiguration,
    EngineData,
    EngineDataArchetype,
    EngineDataBucket,
    hash,
    LevelData,
} from 'sonolus-core'
import { compile, CompileEnvironment } from './compiler'
import { convert, DataType } from './scripting/dataType'
import { Script } from './scripting/script'

export type BuildInput = {
    engine: {
        configuration: EngineConfiguration
        data: {
            buckets: EngineDataBucket[]
            archetypes: EngineDataArchetype[]
            scripts: (Script | (() => Script))[]
        }
    }

    level: {
        data: {
            entities: {
                archetype: number
                data?: {
                    index: number
                    values: DataType[]
                }
            }[]
        }
    }
}

export type BuildOutput = {
    engine: {
        configuration: Resource
        data: Resource
    }
    level: {
        data: Resource
    }
}

export type Resource = {
    buffer: Buffer
    hash: string
}

export function build(buildInput: BuildInput): BuildOutput {
    const compileEnvironment: CompileEnvironment = {
        nodes: [],
    }
    return {
        engine: {
            configuration: toResource<EngineConfiguration>(
                buildInput.engine.configuration
            ),

            data: toResource<EngineData>({
                buckets: buildInput.engine.data.buckets,
                archetypes: buildInput.engine.data.archetypes.map(
                    ({ script, data, input }) => ({
                        script,
                        ...(data == undefined
                            ? {}
                            : { data: convertData(data) }),
                        ...(input == undefined ? {} : { input }),
                    })
                ),
                scripts: buildInput.engine.data.scripts.map((script) => {
                    if (typeof script === 'function') {
                        script = script()
                    }
                    return Object.fromEntries(
                        Object.entries(script).map(
                            ([key, { code: callback, order }]) => [
                                key,
                                {
                                    index: compile(
                                        callback,
                                        compileEnvironment
                                    ),
                                    ...(order == undefined ? {} : { order }),
                                },
                            ]
                        )
                    )
                }),
                nodes: compileEnvironment.nodes,
            }),
        },

        level: {
            data: toResource<LevelData>({
                entities: buildInput.level.data.entities.map(
                    ({ archetype, data }) => ({
                        archetype,
                        ...(data == undefined
                            ? {}
                            : { data: convertData(data) }),
                    })
                ),
            }),
        },
    }
}

function convertData(data: { index: number; values: DataType[] }): {
    index: number
    values: number[]
} {
    return {
        index: data.index,
        values: data.values.map(convert),
    }
}

function toResource<T>(data: T) {
    const buffer = compressSync(data)
    return {
        buffer,
        hash: hash(buffer),
    }
}
