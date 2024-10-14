const vertexShader = `
				struct Interpolators 
				{
					@builtin(position) position: vec4<f32>,
					@location(0) texcoord: vec2<f32>,
				};

				@vertex
				fn VSMain(@builtin(vertex_index) vertexId: u32) -> Interpolators
				{
					let vertices = array<vec2<f32>,3> (vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
					return Interpolators(vec4(vertices[vertexId], 0.0, 1.0), vec2(0.5 * vertices[vertexId] + vec2(0.5, 0.5)));
				}
			`;
const fragmentShader = `
				struct Uniforms {iTime : f32};
				@group(0) @binding(0) var<uniform> uniforms : Uniforms;

				fn Triangle(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, c: vec2<f32>) -> f32
				{
					var ba = b - a;
					var cb = c - b;
					var ac = a - c;
					var pa = p - a;
					var pb = p - b;
					var pc = p - c;
					var q0: vec2<f32> = pa - ba * clamp( dot(pa,ba) / dot(ba,ba), 0.0, 1.0);
					var q1: vec2<f32> = pb - cb * clamp( dot(pb,cb) / dot(cb,cb), 0.0, 1.0);
					var q2: vec2<f32> = pc - ac * clamp( dot(pc,ac) / dot(ac,ac), 0.0, 1.0);   
					var s: f32 = ba.x * ac.y - ba.y * ac.x;
					var d = vec2<f32>(dot(q0, q0), s * (pa.x * ba.y - pa.y * ba.x));
					d = min(d, vec2<f32>(dot(q1, q1), s * (pb.x * cb.y - pb.y * cb.x)));
					d = min(d, vec2<f32>(dot(q2, q2), s * (pc.x * ac.y - pc.y * ac.x)));
					return step(-sqrt(d.x) * sign(d.y), 0.0);
				}

				@fragment
				fn PSMain(@location(0) texcoord: vec2<f32>) -> @location(0) vec4<f32> 
				{
					let t1 = Triangle(texcoord, vec2(0.050, 0.800), vec2(0.675, 0.800), vec2(0.350, 0.250));
					let t2 = Triangle(texcoord, vec2(0.675, 0.800), vec2(0.825, 0.525), vec2(0.512, 0.524));
					let t3 = Triangle(texcoord, vec2(0.513, 0.524), vec2(0.825, 0.525), vec2(0.675, 0.250));
					let t4 = Triangle(texcoord, vec2(0.746, 0.670), vec2(0.825, 0.800), vec2(0.910, 0.670));
					let t5 = Triangle(texcoord, vec2(0.746, 0.670), vec2(0.910, 0.670), vec2(0.825, 0.525));
					let c1 = vec3(0.00, 0.35, 0.61) * t1;
					let c2 = vec3(0.00, 0.40, 0.70) * t2;
					let c3 = vec3(0.00, 0.46, 0.80) * t3;
					let c4 = vec3(0.00, 0.57, 1.00) * t4;
					let c5 = vec3(0.00, 0.52, 0.91) * t5;
					let logo = c1 + c2 + c3 + c4 + c5;
					let f = logo.r > 0.0 || logo.g > 0.0 || logo.b > 0.0;
					return mix(vec4(logo, 1.0), vec4(vec3(sin(uniforms.iTime) * 0.5 + 0.5), 1.0), step(f32(f), 0.0));
				}
			`;
async function Main() {
  if (!navigator.gpu) {
    alert(
      "WebGPU is not supported, see https://webgpu.io or use Chrome Canary with chrome://flags/#enable-unsafe-webgpu",
    );
    return;
  }
  const device = await (await navigator.gpu.requestAdapter()).requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat();
  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: vertexShader }),
      entryPoint: "VSMain",
    },
    fragment: {
      module: device.createShaderModule({ code: fragmentShader }),
      entryPoint: "PSMain",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });
  const context = document.getElementById("canvas").getContext("webgpu");
  context.configure({ device, format, alphaMode: "premultiplied" });
  const uniformBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniformBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const uniforms = new Float32Array(1);
  function Update(time) {
    uniforms[0] = time * 0.001;
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPassColorAttachment = {
      view: textureView,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: "clear",
      storeOp: "store",
    };
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [renderPassColorAttachment],
    });
    renderPassEncoder.setPipeline(renderPipeline);
    renderPassEncoder.setBindGroup(0, uniformBindGroup);
    renderPassEncoder.draw(3, 1, 0, 0);
    renderPassEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(Update);
  }
  requestAnimationFrame(Update);
}
Main();
