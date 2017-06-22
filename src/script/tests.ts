///<reference path="./webgpu.d.ts" />

import { registerTest } from "./playground";

registerTest('browser_support', async playground => {
    let isWebGPUSupported = 'WebGPURenderingContext' in window;
    playground.print(`('WebGPURenderingContext' in window) == ${isWebGPUSupported}`);
    if (!isWebGPUSupported) throw new Error('WebGPU is not supported.');

    let isComputePipelineState = 'WebGPUComputePipelineState' in window;
    playground.print(`('WebGPUComputePipelineState' in window) == ${isComputePipelineState}`);
    if (!isComputePipelineState) throw new Error('WebGPUComputePipelineState is not supported.');

    let isComputeCommandEncoder = 'WebGPUComputeCommandEncoder' in window;
    playground.print(`('WebGPUComputeCommandEncoder' in window) == ${isComputeCommandEncoder}`);
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

registerTest('thread_position_qualifier', async playground => {
    let webgpu = document.createElement('canvas').getContext('webgpu');
    if (!webgpu) throw new Error('WebGPURenderingContext initialization failed.');

    //language=cpp
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
        width: 1024,
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