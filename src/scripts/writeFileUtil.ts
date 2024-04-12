import * as fs from "fs-extra";
import { localizeMessage } from "../main";

export const writeFileTemplate = (name: string, content: string): void => {
    try {
        fs.mkdirSync("./dist/output", { recursive: true });
        fs.writeFileSync(`dist/output/${name}.html`, content, {
            encoding: "utf8",
        });
    } catch (err) {
        console.error(err);
    }
};

export const writeConfiguration = (template: any): void => {
    try {
        const content = {
            body: `./${template.name}.html`,
            enabled: template.enabled,
            from: template.from,
            subject: localizeMessage(template.subjectKey),
            syntax: "liquid",
            template: template.name
        }
        fs.mkdirSync("./dist/output", { recursive: true });
        fs.writeFileSync(`dist/output/${template.name}.json`, JSON.stringify(content), {
            encoding: "utf8",
        });
    } catch (err) {
        console.error(err);
    }
}
