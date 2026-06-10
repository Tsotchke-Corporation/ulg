(function initEshkolHostImports(root) {
  "use strict";

  function createTable(initial) {
    try {
      return new WebAssembly.Table({ initial, element: "anyfunc" });
    } catch (_error) {
      return new WebAssembly.Table({ initial, element: "funcref" });
    }
  }

  function assertObject(value, label) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
  }

  function assertInteger(value, label) {
    if (!Number.isInteger(value)) {
      throw new Error(`${label} must be an integer`);
    }
  }

  const PRODUCTION_HOST_IMPORT_REQUIREMENTS = {
    schema: "eshkol.ulg.production-host-import-candidate.v0",
    status: "production-candidate-runtime-imports-implemented",
    factory: "createEshkolHostImportObject",
    smokeRuntimeAbi: "wasm32-unknown-unknown:eshkol-host-imports-smoke-v0",
    productionRuntimeAbi: "wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0",
    runtimeScope: "production-candidate-host-imports",
    implementationStatus: "production-candidate-runtime-imports-present",
    runtimeSmokeStubsAllowed: false,
    tensorMemoryImports: ["ulg_read_f64", "ulg_write_f64"],
    requiredNonStubImports: [
      "eshkol_is_bignum_tagged",
      "eshkol_rational_to_double",
      "eshkol_bignum_to_double",
      "eshkol_bignum_binary_tagged",
      "eshkol_is_rational_tagged_ptr",
      "eshkol_rational_binary_tagged_ptr",
      "eshkol_bignum_from_overflow",
      "arena_allocate",
      "arena_allocate_vector_with_header",
      "eshkol_shapes_equal",
      "arena_allocate_tensor_with_header",
      "eshkol_broadcast_elementwise_f64",
      "arena_allocate_ad_node_with_header",
      "arena_tape_add_node",
      "eshkol_make_exception_with_header",
      "eshkol_raise",
      "eshkol_intern_symbol_lookup",
      "arena_allocate_cons_with_header",
      "arena_tagged_cons_set_ptr",
      "arena_tagged_cons_set_int64",
      "arena_tagged_cons_set_double",
      "arena_tagged_cons_set_null",
      "eshkol_lambda_registry_add",
    ],
    readinessRequires: [
      "non-stub-host-runtime-imports",
      "validated-f64-tensor-memory-imports",
      "full-physics-validation-pass",
    ],
    blockedBy: [
      "full-physics-validation-not-run",
    ],
  };

  function cloneContract(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function describeEshkolProductionHostImportRequirements() {
    return cloneContract(PRODUCTION_HOST_IMPORT_REQUIREMENTS);
  }

  function createEshkolTensorMemoryBinding(memory, linearMemoryBinding) {
    assertObject(linearMemoryBinding, "linearMemoryBinding");
    if (!(memory instanceof WebAssembly.Memory)) {
      throw new Error("memory must be a WebAssembly.Memory");
    }
    if (linearMemoryBinding.schema !== "eshkol.ulg.tensor-linear-memory-binding.v0") {
      throw new Error("linearMemoryBinding schema is not supported");
    }
    if (typeof linearMemoryBinding.entryExportConsumesOffsets !== "boolean") {
      throw new Error("linearMemoryBinding entry-export consumption must be declared");
    }
    if (linearMemoryBinding.scientificValidation !== false || linearMemoryBinding.fullPhysicsValidation !== false) {
      throw new Error("linearMemoryBinding must not claim physics validation");
    }

    const memoryImport = linearMemoryBinding.memoryImport || {};
    if (memoryImport.module !== "env" || memoryImport.name !== "__linear_memory") {
      throw new Error("linearMemoryBinding must target env.__linear_memory");
    }
    const elementByteLength = linearMemoryBinding.elementByteLength;
    const alignmentBytes = linearMemoryBinding.alignmentBytes;
    assertInteger(elementByteLength, "linearMemoryBinding.elementByteLength");
    assertInteger(alignmentBytes, "linearMemoryBinding.alignmentBytes");
    if (linearMemoryBinding.elementType !== "f64" || elementByteLength !== 8) {
      throw new Error("linearMemoryBinding only supports f64 elements");
    }
    const baseOffset = memoryImport.baseOffset;
    const totalByteLength = memoryImport.totalByteLength;
    assertInteger(baseOffset, "linearMemoryBinding.memoryImport.baseOffset");
    assertInteger(totalByteLength, "linearMemoryBinding.memoryImport.totalByteLength");
    if (baseOffset < 0 || totalByteLength <= 0) {
      throw new Error("linearMemoryBinding memory range must be positive");
    }
    if (memory.buffer.byteLength < baseOffset + totalByteLength) {
      throw new Error("linearMemoryBinding range exceeds linear memory");
    }

    const tensorSpecs = linearMemoryBinding.tensors;
    if (!Array.isArray(tensorSpecs) || tensorSpecs.length === 0) {
      throw new Error("linearMemoryBinding.tensors must be a non-empty array");
    }
    const views = Object.create(null);
    const specsById = Object.create(null);
    const ranges = [];
    for (const spec of tensorSpecs) {
      assertObject(spec, "linearMemoryBinding tensor");
      if (typeof spec.id !== "string" || spec.id.length === 0) {
        throw new Error("linearMemoryBinding tensor id must be a non-empty string");
      }
      if (spec.dtype !== "f64") {
        throw new Error(`${spec.id} must use f64 dtype`);
      }
      if (typeof spec.consumedByEntryExport !== "boolean") {
        throw new Error(`${spec.id} must declare entry-export consumption`);
      }
      assertInteger(spec.byteOffset, `${spec.id}.byteOffset`);
      assertInteger(spec.byteLength, `${spec.id}.byteLength`);
      assertInteger(spec.elementCount, `${spec.id}.elementCount`);
      if (spec.byteOffset % alignmentBytes !== 0) {
        throw new Error(`${spec.id} byteOffset is not aligned`);
      }
      if (spec.byteLength !== spec.elementCount * elementByteLength) {
        throw new Error(`${spec.id} byteLength does not match elementCount`);
      }
      const end = spec.byteOffset + spec.byteLength;
      if (spec.byteOffset < baseOffset || end > baseOffset + totalByteLength) {
        throw new Error(`${spec.id} is outside the declared memory range`);
      }
      ranges.push({ id: spec.id, start: spec.byteOffset, end });
      specsById[spec.id] = spec;
      views[spec.id] = new Float64Array(memory.buffer, spec.byteOffset, spec.elementCount);
    }
    ranges.sort((left, right) => left.start - right.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index - 1].end > ranges[index].start) {
        throw new Error(`${ranges[index - 1].id} overlaps ${ranges[index].id}`);
      }
    }

    return {
      memory,
      linearMemoryBinding,
      views,
      descriptorFor(id) {
        return specsById[id] || null;
      },
      writeTensor(id, values) {
        const view = views[id];
        if (!view) throw new Error(`unknown tensor id: ${id}`);
        if (!Array.isArray(values) && !(values instanceof Float64Array)) {
          throw new Error(`${id} values must be an array`);
        }
        if (values.length !== view.length) {
          throw new Error(`${id} expected ${view.length} values, got ${values.length}`);
        }
        view.set(values);
      },
      readTensor(id) {
        const view = views[id];
        if (!view) throw new Error(`unknown tensor id: ${id}`);
        return Array.from(view);
      },
      fillTensor(id, value) {
        const view = views[id];
        if (!view) throw new Error(`unknown tensor id: ${id}`);
        view.fill(Number(value));
      },
      snapshot() {
        return Object.fromEntries(Object.keys(views).map((id) => [id, Array.from(views[id])]));
      },
    };
  }

  function createBumpAllocator(memory, options, record) {
    let nextAllocation = Number.isInteger(options.allocatorBase)
      ? options.allocatorBase
      : Number.isInteger(options.smokeAllocatorBase)
        ? options.smokeAllocatorBase
        : 262144;
    const align = (value, alignment = 8) => (value + (alignment - 1)) & ~(alignment - 1);
    return (name, requestedByteLength) => {
      record(name, [requestedByteLength]);
      const requested = Math.max(Number(requestedByteLength) || 16, 16);
      const aligned = align(nextAllocation);
      const byteLength = align(requested);
      if (aligned + byteLength > memory.buffer.byteLength) {
        throw new Error(`${name} allocation exceeds linear memory`);
      }
      nextAllocation = aligned + byteLength;
      new Uint8Array(memory.buffer, aligned, byteLength).fill(0);
      return aligned;
    };
  }

  function installRuntimeSmokeStubs(env, options, record) {
    const allocateBytes = createBumpAllocator(env.__linear_memory, options, record);
    const stub = (name, result) => (...args) => {
      record(name, args);
      return result;
    };

    Object.assign(env, {
      eshkol_is_bignum_tagged: stub("eshkol_is_bignum_tagged", 0),
      eshkol_rational_to_double: stub("eshkol_rational_to_double", 0),
      eshkol_bignum_to_double: stub("eshkol_bignum_to_double", 0),
      eshkol_bignum_binary_tagged: stub("eshkol_bignum_binary_tagged", undefined),
      eshkol_is_rational_tagged_ptr: stub("eshkol_is_rational_tagged_ptr", 0),
      eshkol_rational_binary_tagged_ptr: stub("eshkol_rational_binary_tagged_ptr", undefined),
      eshkol_bignum_from_overflow: stub("eshkol_bignum_from_overflow", 0),
      arena_allocate: (...args) => {
        return allocateBytes("arena_allocate", args[1]);
      },
      arena_allocate_vector_with_header: (...args) => {
        return allocateBytes("arena_allocate_vector_with_header", args[1]);
      },
      eshkol_shapes_equal: stub("eshkol_shapes_equal", 1n),
      arena_allocate_tensor_with_header: (...args) => {
        return allocateBytes("arena_allocate_tensor_with_header", 64);
      },
      eshkol_broadcast_elementwise_f64: stub("eshkol_broadcast_elementwise_f64", 0n),
      arena_allocate_ad_node_with_header: (...args) => {
        return allocateBytes("arena_allocate_ad_node_with_header", 64);
      },
      arena_tape_add_node: (...args) => {
        record("arena_tape_add_node", args);
        return args[1] || allocateBytes("arena_tape_add_node", 16);
      },
      eshkol_make_exception_with_header: (...args) => {
        return allocateBytes("eshkol_make_exception_with_header", 32);
      },
      eshkol_raise: (...args) => {
        record("eshkol_raise", args);
        throw new Error("eshkol_raise called in runtime smoke stubs");
      },
      eshkol_intern_symbol_lookup: stub("eshkol_intern_symbol_lookup", 0),
      arena_allocate_cons_with_header: (...args) => {
        record("arena_allocate_cons_with_header", args);
        return allocateBytes(16);
      },
      arena_tagged_cons_set_ptr: stub("arena_tagged_cons_set_ptr", undefined),
      arena_tagged_cons_set_int64: stub("arena_tagged_cons_set_int64", undefined),
      arena_tagged_cons_set_double: stub("arena_tagged_cons_set_double", undefined),
      arena_tagged_cons_set_null: stub("arena_tagged_cons_set_null", undefined),
      eshkol_lambda_registry_add: stub("eshkol_lambda_registry_add", undefined),
    });
  }

  function installProductionCandidateRuntimeImports(env, options, record) {
    const allocateBytes = createBumpAllocator(env.__linear_memory, options, record);
    const asNumber = (value, label) => {
      const numeric = typeof value === "bigint" ? Number(value) : Number(value);
      if (!Number.isFinite(numeric)) {
        throw new Error(`${label} must be finite`);
      }
      return numeric;
    };
    const unsupportedTaggedOperation = (name) => (...args) => {
      record(name, args);
      throw new Error(`${name} requires validated tagged numeric runtime support`);
    };
    const writeI32 = (offset, value) => {
      new DataView(env.__linear_memory.buffer).setInt32(offset, Number(value) || 0, true);
    };
    Object.assign(env, {
      eshkol_is_bignum_tagged: (value) => {
        record("eshkol_is_bignum_tagged", [value]);
        return 0;
      },
      eshkol_rational_to_double: (value) => {
        record("eshkol_rational_to_double", [value]);
        return asNumber(value, "eshkol_rational_to_double value");
      },
      eshkol_bignum_to_double: (value) => {
        record("eshkol_bignum_to_double", [value]);
        return asNumber(value, "eshkol_bignum_to_double value");
      },
      eshkol_bignum_binary_tagged: unsupportedTaggedOperation("eshkol_bignum_binary_tagged"),
      eshkol_is_rational_tagged_ptr: (value) => {
        record("eshkol_is_rational_tagged_ptr", [value]);
        return 0;
      },
      eshkol_rational_binary_tagged_ptr: unsupportedTaggedOperation("eshkol_rational_binary_tagged_ptr"),
      eshkol_bignum_from_overflow: (value) => {
        record("eshkol_bignum_from_overflow", [value]);
        return asNumber(value, "eshkol_bignum_from_overflow value") | 0;
      },
      arena_allocate: (...args) => allocateBytes("arena_allocate", args[1]),
      arena_allocate_vector_with_header: (...args) => {
        const ptr = allocateBytes("arena_allocate_vector_with_header", args[1]);
        writeI32(ptr, args[0]);
        return ptr;
      },
      eshkol_shapes_equal: (leftRank, leftShape, rightRank, rightShape) => {
        record("eshkol_shapes_equal", [leftRank, leftShape, rightRank, rightShape]);
        return leftRank === rightRank && leftShape === rightShape ? 1n : 0n;
      },
      arena_allocate_tensor_with_header: (...args) => {
        const ptr = allocateBytes("arena_allocate_tensor_with_header", 64);
        writeI32(ptr, args[0]);
        return ptr;
      },
      eshkol_broadcast_elementwise_f64: unsupportedTaggedOperation("eshkol_broadcast_elementwise_f64"),
      arena_allocate_ad_node_with_header: (...args) => {
        const ptr = allocateBytes("arena_allocate_ad_node_with_header", 64);
        writeI32(ptr, args[0]);
        return ptr;
      },
      arena_tape_add_node: (...args) => {
        record("arena_tape_add_node", args);
        return args[1] || allocateBytes("arena_tape_add_node", 16);
      },
      eshkol_make_exception_with_header: (...args) => {
        const ptr = allocateBytes("eshkol_make_exception_with_header", 32);
        writeI32(ptr, args[0]);
        return ptr;
      },
      eshkol_raise: (...args) => {
        record("eshkol_raise", args);
        throw new Error("eshkol_raise called by production-candidate host imports");
      },
      eshkol_intern_symbol_lookup: (symbolPtr) => {
        record("eshkol_intern_symbol_lookup", [symbolPtr]);
        return symbolPtr || 0;
      },
      arena_allocate_cons_with_header: (...args) => {
        const ptr = allocateBytes("arena_allocate_cons_with_header", 16);
        writeI32(ptr, args[0]);
        return ptr;
      },
      arena_tagged_cons_set_ptr: (...args) => {
        record("arena_tagged_cons_set_ptr", args);
      },
      arena_tagged_cons_set_int64: (...args) => {
        record("arena_tagged_cons_set_int64", args);
      },
      arena_tagged_cons_set_double: (...args) => {
        record("arena_tagged_cons_set_double", args);
      },
      arena_tagged_cons_set_null: (...args) => {
        record("arena_tagged_cons_set_null", args);
      },
      eshkol_lambda_registry_add: (...args) => {
        record("eshkol_lambda_registry_add", args);
      },
    });
  }

  function createEshkolHostImportObject(options = {}) {
    if (options.runtimeSmokeStubs === true && options.productionCandidateRuntimeImports === true) {
      throw new Error("runtimeSmokeStubs and productionCandidateRuntimeImports are mutually exclusive");
    }
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
    const assertMemoryRange = (offset, byteLength, label) => {
      const numericOffset = Number(offset);
      if (!Number.isInteger(numericOffset) || numericOffset < 0) {
        throw new Error(`${label} offset must be a non-negative integer`);
      }
      if (numericOffset + byteLength > memory.buffer.byteLength) {
        throw new Error(`${label} exceeds linear memory`);
      }
      return numericOffset;
    };
    const dataView = () => new DataView(memory.buffer);

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
      ulg_read_f64: (offset) => {
        record("ulg_read_f64", [offset]);
        return dataView().getFloat64(assertMemoryRange(offset, 8, "ulg_read_f64"), true);
      },
      ulg_write_f64: (offset, value) => {
        record("ulg_write_f64", [offset, value]);
        dataView().setFloat64(assertMemoryRange(offset, 8, "ulg_write_f64"), Number(value), true);
        return 0;
      },
    };
    if (options.runtimeSmokeStubs === true) {
      installRuntimeSmokeStubs(env, options, record);
    } else if (options.productionCandidateRuntimeImports === true) {
      installProductionCandidateRuntimeImports(env, options, record);
    }

    return {
      env,
      importObject: { env },
      memory,
      runtimeScope: options.productionCandidateRuntimeImports === true
        ? PRODUCTION_HOST_IMPORT_REQUIREMENTS.runtimeScope
        : "deterministic-runtime-smoke-stubs",
      implementationStatus: options.productionCandidateRuntimeImports === true
        ? PRODUCTION_HOST_IMPORT_REQUIREMENTS.implementationStatus
        : "smoke-stubs-not-production",
      output,
      calls,
      getOutput() {
        return output.join("");
      },
    };
  }

  const api = {
    createEshkolHostImportObject,
    createEshkolTensorMemoryBinding,
    describeEshkolProductionHostImportRequirements,
  };
  root.EshkolHostImports = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this));
