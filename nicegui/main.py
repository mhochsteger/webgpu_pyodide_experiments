#!/usr/bin/env python3
import asyncio
from typing import Optional

import base64
import marshal
from typing_extensions import Self

from nicegui import app, ui
from nicegui.element import Element
from nicegui.events import (
    GenericEventArguments,
    Handler,
    SceneClickEventArguments,
    SceneClickHit,
    SceneDragEventArguments,
    handle_event,
)

app.add_static_files("/pyodide", "../pyodide")
app.add_static_files("/webgpu", "../webgpu")


class WebGPUScene(
    Element,
    component="webgpu_scene.js",
    dependencies=[
        "./pyodide/pyodide.js",
    ],
    default_classes="",
):
    # pylint: disable=import-outside-toplevel

    def __init__(
        self,
        width: int = 400,
        height: int = 300,
        on_click: Optional[Handler[SceneClickEventArguments]] = None,
        on_drag_start: Optional[Handler[SceneDragEventArguments]] = None,
        on_drag_end: Optional[Handler[SceneDragEventArguments]] = None,
        background_color: str = "#eee",
    ) -> None:
        """Webgpu scene."""
        super().__init__()
        self._props["width"] = width
        self._props["height"] = height
        self._props["background_color"] = background_color

        self.on("init", self._handle_init)
        self.on("click3d", self._handle_click)
        self.on("dragstart", self._handle_drag)
        self.on("dragend", self._handle_drag)
        self._click_handlers = [on_click] if on_click else []
        self._drag_start_handlers = [on_drag_start] if on_drag_start else []
        self._drag_end_handlers = [on_drag_end] if on_drag_end else []
        self.python_expression = ""

    def on_click(self, callback: Handler[SceneClickEventArguments]) -> Self:
        """Add a callback to be invoked when a 3D object is clicked."""
        self._click_handlers.append(callback)
        return self

    def on_drag_start(self, callback: Handler[SceneDragEventArguments]) -> Self:
        """Add a callback to be invoked when a 3D object is dragged."""
        self._drag_start_handlers.append(callback)
        return self

    def on_drag_end(self, callback: Handler[SceneDragEventArguments]) -> Self:
        """Add a callback to be invoked when a 3D object is dropped."""
        self._drag_end_handlers.append(callback)
        return self

    def __enter__(self) -> Self:
        print("create scene")
        super().__enter__()
        return self

    def _handle_init(self, e: GenericEventArguments) -> None:
        pass

    async def initialized(self) -> None:
        """Wait until the scene is initialized."""
        event = asyncio.Event()
        self.on("init", event.set, [])
        await self.client.connected()
        await event.wait()

    def _handle_click(self, e: GenericEventArguments) -> None:
        arguments = SceneClickEventArguments(
            sender=self,
            client=self.client,
            click_type=e.args["click_type"],
            button=e.args["button"],
            alt=e.args["alt_key"],
            ctrl=e.args["ctrl_key"],
            meta=e.args["meta_key"],
            shift=e.args["shift_key"],
            hits=[
                SceneClickHit(
                    object_id=hit["object_id"],
                    object_name=hit["object_name"],
                    x=hit["point"]["x"],
                    y=hit["point"]["y"],
                    z=hit["point"]["z"],
                )
                for hit in e.args["hits"]
            ],
        )
        for handler in self._click_handlers:
            handle_event(handler, arguments)

    def _handle_drag(self, e: GenericEventArguments) -> None:
        return

    def __len__(self) -> int:
        return 1

    def _handle_delete(self) -> None:
        # binding.remove(list(self.objects.values()))
        super()._handle_delete()

    def clear(self) -> None:
        """Remove all objects from the scene."""
        super().clear()

    def redraw(self, code):
        func = marshal.dumps(draw_function.__code__)
        func = base64.b64encode(func).decode("utf-8")
        data = [func, code]
        self.run_method("run_user_function", data)


ui.add_head_html('<script type="text/javascript" src="./pyodide/pyodide.js"></script>')

inp = ui.input("function")
button = ui.button("update")
scene = WebGPUScene(width=1024, height=800)
button.on_click(lambda _: scene.redraw(inp.value))


def draw_function(expr):
    import js
    import ngsolve as ngs
    import webgpu.main
    import webgpu.mesh
    from webgpu.main import gpu

    mesh = ngs.Mesh(ngs.unit_square.GenerateMesh(maxh=0.5))
    order = 6
    region = mesh.Region(ngs.VOL)
    cf = eval(expr, globals() | ngs.__dict__, locals())
    n_trigs, buffers = webgpu.mesh.create_mesh_buffers(gpu.device, region)
    buffers = buffers | webgpu.mesh.create_function_value_buffers(
        gpu.device, cf, region, order
    )
    mesh_object = webgpu.mesh.MeshRenderObject(gpu, buffers, n_trigs)
    webgpu.main.mesh_object = mesh_object
    js.requestAnimationFrame(webgpu.main.render_function)


ui.run()
