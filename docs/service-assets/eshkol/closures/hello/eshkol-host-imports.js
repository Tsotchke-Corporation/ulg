(function initEshkolHostImports(root) {
  "use strict";

  function createTable(initial) {
    try {
      return new WebAssembly.Table({ initial, element: "anyfunc" });
    } catch (_error) {
      return new WebAssembly.Table({ initial, element: "funcref" });
    }
  }

  function createEshkolHostImportObject(options = {}) {
    const memory = options.memory || new WebAssembly.Memory({
      initial: options.memoryInitialPages || 256,
      maximum: options.memoryMaximumPages || 1024,
    });
    const output = [];
    const calls = [];
    const record = (name, args) => {
      if (options.traceCalls === true) {
        calls.push({ name, argCount: args.length });
      }
    };
    const writeChar = (value) => {
      const charCode = Number(value) & 0xff;
      const text = String.fromCharCode(charCode);
      output.push(text);
      if (typeof options.onChar === "function") options.onChar(text, charCode);
      return charCode;
    };

    const env = {
      __linear_memory: memory,
      __stack_pointer: new WebAssembly.Global({ value: "i32", mutable: true }, options.stackPointerValue || 1048576),
      __indirect_function_table: createTable(options.tableInitial || 256),
      __eshkol_register_parallel_workers: (...args) => { record("__eshkol_register_parallel_workers", args); },
      eshkol_init_stack_size: (...args) => { record("eshkol_init_stack_size", args); },
      eshkol_runtime_init: (...args) => { record("eshkol_runtime_init", args); return 0; },
      get_global_arena: (...args) => { record("get_global_arena", args); return options.globalArenaPtr || 1; },
      eshkol_lambda_registry_init: (...args) => { record("eshkol_lambda_registry_init", args); },
      __eshkol_lib_init__: (...args) => { record("__eshkol_lib_init__", args); },
      eshkol_display_value: (value, ...args) => {
        record("eshkol_display_value", [value, ...args]);
        output.push(String(value));
        if (typeof options.onDisplay === "function") options.onDisplay(value);
      },
      eshkol_runtime_current_output_fp: (...args) => {
        record("eshkol_runtime_current_output_fp", args);
        return options.outputFilePointer || 0;
      },
      fputc: (charCode, fp) => {
        record("fputc", [charCode, fp]);
        return writeChar(charCode);
      },
    };

    return {
      env,
      importObject: { env },
      memory,
      output,
      calls,
      getOutput() {
        return output.join("");
      },
    };
  }

  const api = { createEshkolHostImportObject };
  root.EshkolHostImports = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this));
