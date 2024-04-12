import * as fs from "fs";
import { evaluateWithLocalizeMessage, localizeMessage } from "../scripts/localizeMessage";
import * as path from "node:path";

export function readTemplate(templateName: string): string {
    const rootPath = getRootPath();
    const content = fs.readFileSync(`${rootPath}/templates/${templateName}.html`, "utf8")
    return evaluateWithLocalizeMessage(content, localizeMessage);
}

export function getRootPath() {
    let rootPath = __dirname;
    if (rootPath.includes('dist')) {
        rootPath = rootPath.replace('dist/', '')
        return path.dirname(rootPath);
    }
    return rootPath
}
