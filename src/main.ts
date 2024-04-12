import { writeConfiguration, writeFileTemplate } from "./scripts/writeFileUtil"
import { templates, languages } from "../config.json"
import { readTemplate } from "./templates/util"

export { localizeMessage } from "./scripts/localizeMessage"


if (templates.length === 0) {
    throw new Error("No templates found")
}

if (languages.length === 0) {
    throw new Error("No languages found")
}

const validateHTML = async (templateContent: string) => {
    const validator = require("html-validator")
    const options = {
        data: templateContent,
        format: "text",
    }
    try {
        const result = await validator(options)
        console.log(result)
    } catch (error) {
        console.error(error)
    }
}

const generateTemplates = async () => {
    for (const template of templates) {
        console.log(`Internationalize : ${template.name}.html`)
        const templateContent = readTemplate(template.name)
        await validateHTML(templateContent)
        writeFileTemplate(template.name, templateContent)
        writeConfiguration(template)
        console.log(`Internationalize : ${template.name}.html DONE`)
    }
}

const main = (): void => {
    console.log("All internationalization start")
    generateTemplates().then(_ => console.log("All internationalization done"))
}
main()

