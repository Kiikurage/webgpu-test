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