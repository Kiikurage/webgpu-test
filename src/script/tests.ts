///<reference path="./webgpu.d.ts" />

import { registerTest } from "./playground";

registerTest('browser_support', async playground => {
    let isWebGPUSupported = 'WebGPURenderingContext' in window;
    playground.print(`('WebGPURenderingContext' in window) == ${isWebGPUSupported}`);

    let isComputePipelineState = 'WebGPUComputePipelineState' in window;
    playground.print(`('WebGPUComputePipelineState' in window) == ${isComputePipelineState}`);

    let isComputeCommandEncoder = 'WebGPUComputeCommandEncoder' in window;
    playground.print(`('WebGPUComputeCommandEncoder' in window) == ${isComputeCommandEncoder}`);

    if (!isWebGPUSupported) throw new Error('WebGPU is not supported.');
    if (!isComputePipelineState) throw new Error('WebGPUComputePipelineState is not supported.');
    if (!isComputeCommandEncoder) throw new Error('isComputeCommandEncoder is not supported.');
});

async function runNoopKernel(gridSize: number[], threadgroupSize: number[]) {
    let webgpu = document.createElement('canvas').getContext('webgpu');
    if (!webgpu) throw new Error('WebGPURenderingContext initialization failed.');

    let library = webgpu.createLibrary('void kernel noop(){}');
    let pipelineState = webgpu.createComputePipelineState(library.functionWithName('noop'));

    let commandQueue = webgpu.createCommandQueue();
    let commandBuffer = commandQueue.createCommandBuffer();

    let commandEncoder = commandBuffer.createComputeCommandEncoder();

    commandEncoder.setComputePipelineState(pipelineState);
    commandEncoder.dispatch({
        width: gridSize[0],
        height: gridSize[1],
        depth: gridSize[2],
    }, {
        width: threadgroupSize[0],
        height: threadgroupSize[1],
        depth: threadgroupSize[2],
    });
    commandEncoder.endEncoding();

    let promise = commandBuffer.completed;
    commandBuffer.commit();

    return promise;
}

registerTest('simplest_kernel_1', async playground => runNoopKernel([1, 1, 1], [1, 1, 1]));
registerTest('simplest_kernel_2', async playground => runNoopKernel([1, 1, 1], [8, 1, 1]));
registerTest('simplest_kernel_3', async playground => runNoopKernel([1, 1, 1], [8, 8, 1]));
registerTest('simplest_kernel_4', async playground => runNoopKernel([1, 1, 1], [8, 8, 8]));
registerTest('simplest_kernel_5', async playground => runNoopKernel([8, 1, 1], [1024, 1, 1]));

registerTest('copy_kernel', async playground => {
    let webgpu = document.createElement('canvas').getContext('webgpu');
    if (!webgpu) throw new Error('WebGPURenderingContext initialization failed.');

    let library = webgpu.createLibrary(`
kernel void copy(const device float *A[[buffer(0)]], 
                 device float *B[[buffer(1)]]) 
{
    for (int i = 0; i < 100; i++)
    {
        B[i] = A[i];
    }
}
`);
    let pipelineState = webgpu.createComputePipelineState(library.functionWithName('copy'));

    let commandQueue = webgpu.createCommandQueue();
    let commandBuffer = commandQueue.createCommandBuffer();

    let A = new Float32Array(100);
    for (let i = 0; i < 100; i++) A[i] = i;
    let B = new Float32Array(100);

    let ABuffer = webgpu.createBuffer(A);
    let BBuffer = webgpu.createBuffer(B);

    let commandEncoder = commandBuffer.createComputeCommandEncoder();

    commandEncoder.setComputePipelineState(pipelineState);
    commandEncoder.setBuffer(ABuffer, 0, 0);
    commandEncoder.setBuffer(BBuffer, 0, 1);
    commandEncoder.dispatch({
        width: 1,
        height: 1,
        depth: 1,
    }, {
        width: 1,
        height: 1,
        depth: 1,
    });
    commandEncoder.endEncoding();

    let promise = commandBuffer.completed;
    commandBuffer.commit();

    await promise;

    A = new Float32Array(ABuffer.contents);
    B = new Float32Array(BBuffer.contents);
    for (let i = 0; i < 100; i++) {
        if (B[i] !== A[i]) throw new Error(`Assertion failed: A[${i}](=${A[i]}) !== B[${i}](=${B[i]})`);
    }

    return promise;
});

registerTest('thread_position_qualifier1', async playground => {
    let webgpu = document.createElement('canvas').getContext('webgpu');
    if (!webgpu) throw new Error('WebGPURenderingContext initialization failed.');

    let library = webgpu.createLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void copy(device float *A[[buffer(0)]],
                 uint3 thread_position_in_grid[[thread_position_in_grid]],
                 uint3 thread_position_in_threadgroup[[thread_position_in_threadgroup]],
                 uint thread_index_in_threadgroup[[thread_index_in_threadgroup]],
                 uint3 threadgroup_position_in_grid[[threadgroup_position_in_grid]],
                 uint3 threads_per_grid[[threads_per_grid]],
                 uint3 threads_per_threadgroup[[threads_per_threadgroup]],
                 uint3 threadgroups_per_grid[[threadgroups_per_grid]],
                 uint thread_execution_width[[thread_execution_width]])
{
    if (thread_position_in_grid[0] != 2*5-1 ||
        thread_position_in_grid[1] != 3*6-1 ||
        thread_position_in_grid[2] != 4*7-1) return;
    
    A[0] = thread_position_in_grid[0];
    A[1] = thread_position_in_grid[1];
    A[2] = thread_position_in_grid[2];
    A[3] = thread_position_in_threadgroup[0];
    A[4] = thread_position_in_threadgroup[1];
    A[5] = thread_position_in_threadgroup[2];
    A[6] = thread_index_in_threadgroup;
    A[7] = threadgroup_position_in_grid[0];
    A[8] = threadgroup_position_in_grid[1];
    A[9] = threadgroup_position_in_grid[2];
    A[10] = threads_per_grid[0];
    A[11] = threads_per_grid[1];
    A[12] = threads_per_grid[2];
    A[13] = threads_per_threadgroup[0];
    A[14] = threads_per_threadgroup[1];
    A[15] = threads_per_threadgroup[2];
    A[16] = threadgroups_per_grid[0];
    A[17] = threadgroups_per_grid[1];
    A[18] = threadgroups_per_grid[2];
    A[19] = thread_execution_width;
}
`);
    let pipelineState = webgpu.createComputePipelineState(library.functionWithName('copy'));

    let commandQueue = webgpu.createCommandQueue();
    let commandBuffer = commandQueue.createCommandBuffer();

    let A = new Float32Array(20);
    for (let i = 0; i < 20; i++) A[i] = 0;

    let ABuffer = webgpu.createBuffer(A);

    let commandEncoder = commandBuffer.createComputeCommandEncoder();

    commandEncoder.setComputePipelineState(pipelineState);
    commandEncoder.setBuffer(ABuffer, 0, 0);
    commandEncoder.dispatch({
        width: 2,
        height: 3,
        depth: 4,
    }, {
        width: 5,
        height: 6,
        depth: 7,
    });
    commandEncoder.endEncoding();

    let promise = commandBuffer.completed;
    commandBuffer.commit();

    await promise;

    A = new Float32Array(ABuffer.contents);
    let expects = [
        2 * 5 - 1,
        3 * 6 - 1,
        4 * 7 - 1,
        5 - 1,
        6 - 1,
        7 - 1,
        5 * 6 * 7 - 1,
        2 - 1,
        3 - 1,
        4 - 1,
        2 * 5,
        3 * 6,
        4 * 7,
        5,
        6,
        7,
        2,
        3,
        4,
        32
    ];
    for (let i = 0; i < 20; i++) playground.print(`A[${i}] = ${A[i]}`);
    for (let i = 0; i < 20; i++) {
        if (A[i] !== expects[i]) throw new Error(`Assertion failed: A[${i}](=${A[i]}) !== ${expects[i]}`);
    }

    return promise;
});

registerTest('thread_position_qualifier2', async playground => {
    let webgpu = document.createElement('canvas').getContext('webgpu');
    if (!webgpu) throw new Error('WebGPURenderingContext initialization failed.');

    let library = webgpu.createLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void copy(const device float *A[[buffer(0)]],
                 device float *B[[buffer(1)]],
                 uint gid[[thread_position_in_grid]],
                 uint num_threads[[threads_per_grid]])
{
    for (uint i = gid; i < 4096; i += num_threads)
    {
        B[i] = A[i];
    }
}
`);
    let pipelineState = webgpu.createComputePipelineState(library.functionWithName('copy'));

    let commandQueue = webgpu.createCommandQueue();
    let commandBuffer = commandQueue.createCommandBuffer();

    let A = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) A[i] = i;
    let B = new Float32Array(4096);

    let ABuffer = webgpu.createBuffer(A);
    let BBuffer = webgpu.createBuffer(B);

    let commandEncoder = commandBuffer.createComputeCommandEncoder();

    commandEncoder.setComputePipelineState(pipelineState);
    commandEncoder.setBuffer(ABuffer, 0, 0);
    commandEncoder.setBuffer(BBuffer, 0, 1);
    commandEncoder.dispatch({
        width: 1,
        height: 1,
        depth: 1,
    }, {
        width: 8,
        height: 1,
        depth: 1,
    });
    commandEncoder.endEncoding();

    let promise = commandBuffer.completed;
    commandBuffer.commit();

    await promise;

    A = new Float32Array(ABuffer.contents);
    B = new Float32Array(BBuffer.contents);
    for (let i = 0; i < 4096; i++) {
        if (B[i] !== A[i]) throw new Error(`Assertion failed: A[${i}](=${A[i]}) !== B[${i}](=${B[i]})`);
    }

    return promise;
});

registerTest('memory_barrier', async playground => {
    let webgpu = document.createElement('canvas').getContext('webgpu');
    if (!webgpu) throw new Error('WebGPURenderingContext initialization failed.');

    //language=cpp
    let library = webgpu.createLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void copy(device float *A[[buffer(0)]], 
                 uint gid[[thread_position_in_grid]]) 
{
    for (uint i = 0; i < 4; i++)
    {
        uint pos = i * 1024 + gid;
        float v = (pos < 4095) ? A[pos + 1] : 0;

        threadgroup_barrier(mem_flags::mem_device);

        if (pos < 4095) A[pos] = v;
    }
}
`);
    let pipelineState = webgpu.createComputePipelineState(library.functionWithName('copy'));

    let commandQueue = webgpu.createCommandQueue();
    let commandBuffer = commandQueue.createCommandBuffer();

    let A = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) A[i] = i;

    let ABuffer = webgpu.createBuffer(A);

    let commandEncoder = commandBuffer.createComputeCommandEncoder();

    commandEncoder.setComputePipelineState(pipelineState);
    commandEncoder.setBuffer(ABuffer, 0, 0);
    commandEncoder.dispatch({
        width: 1,
        height: 1,
        depth: 1,
    }, {
        width: 1024,
        height: 1,
        depth: 1,
    });
    commandEncoder.endEncoding();

    let promise = commandBuffer.completed;
    commandBuffer.commit();

    await promise;

    A = new Float32Array(ABuffer.contents);
    for (let i = 1; i < 4095; i++) {
        if (A[i - 1] !== i) throw new Error(`Assertion failed: A[${i} - 1](=${A[i - 1]}) !== ${i}`);
    }

    return promise;
})