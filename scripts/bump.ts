// THIS SCRIPT IS WRITTEN FOR DENO, UNTIL BUN SUPPORTS RUNNING HTTPS FILES

import { increment, valid } from "https://deno.land/std@0.177.0/semver/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts";
import {
  Confirm,
  Input,
  Select,
  type SelectValueOptions,
  prompt
} from "https://deno.land/x/cliffy@v0.25.7/prompt/mod.ts";
import { globber } from "https://deno.land/x/globber@0.1.0/mod.ts";

async function pickVersion(version: string) {
  const patch = increment(version, "patch");
  const minor = increment(version, "minor");
  const major = increment(version, "major");

  const options: SelectValueOptions = [
    {
      name: `Patch: ${patch}`,
      value: patch || version
    },
    {
      name: `Minor: ${minor}`,
      value: minor || version
    },
    {
      name: `Major: ${major}`,
      value: major || version
    },
    Select.separator("----------"),
    {
      name: "Custom",
      value: "custom"
    }
  ];
  const result = await prompt([
    {
      name: "version",
      message: "Select the version you want.",
      type: Select,
      options
    }
  ]);

  if (result.version === "custom") {
    const custom = await prompt([
      {
        name: "version",
        message: "Version",
        type: Input,
        validate: (value: string) => {
          if (!value) return "Version cannot be empty";
          if (!valid(value)) return "Version is not valid";
          return true;
        }
      }
    ]);

    result.version = custom.version;
  }

  return result;
}

await new Command()
  .arguments("<dirs...:string>")
  .option("--cwd <cwd:string>", "Print the current working directory", {
    default: Deno.cwd()
  })
  .action(async ({ cwd }, ...dirs: [string, ...Array<string>]) => {
    const iterator = globber({
      extensions: [".json", ".jsonc", ".json5"],
      cwd,
      include: dirs
    });

    const files: string[] = [];

    for await (const entry of iterator) {
      if (files.includes(entry.absolute)) continue;
      files.push(entry.absolute);
    }

    let firstRun = false;

    let pickedVersion: string | undefined;
    for await (const file of files) {
      const content = await Deno.readTextFile(file);

      const pkgJSON = JSON.parse(content);
      const { version } = pkgJSON;

      if (!version) continue;
      if (!valid(version)) {
        throw new TypeError(
          `${file} file contained version "${version}", which is not a valid version string`
        );
      }
      const newVersion = pickedVersion || (await pickVersion(version)).version;

      if (!firstRun) {
        const result = await Confirm.prompt(
          "Do you want to use the same version, for all packages?"
        );

        if (result) {
          pickedVersion = newVersion;
        }
        firstRun = true;
      }

      pkgJSON.version = newVersion;
      const newContent = `${JSON.stringify(pkgJSON, null, 2)}${
        content.endsWith("\n") ? "\n" : ""
      }`;
      await Deno.writeTextFile(file, newContent);
    }
  })
  .parse(Deno.args);
