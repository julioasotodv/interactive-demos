importScripts("https://cdn.jsdelivr.net/pyodide/v0.22.1/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading...'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/0.14.4/dist/wheels/bokeh-2.4.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/0.14.4/dist/wheels/panel-0.14.4-py3-none-any.whl', 'pyodide-http==0.1.0', 'holoviews', 'hvplot', 'numpy', 'pandas']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Loading...`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Loading...'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

#!/usr/bin/env python
# coding: utf-8

# In[1]:


import numpy as np
import pandas as pd
import panel as pn
pn.extension('mathjax')
import holoviews as hv
hv.extension("bokeh")
import hvplot.pandas


# In[ ]:


def four_param_logistic(X, a, b, c, d):
    return c + (d - c) / (1 + np.exp(b*(X-a)))


# In[ ]:


def set_toolbar_autohide(plot, element):
    bokeh_plot = plot.state
    bokeh_plot.toolbar.autohide = True


# In[ ]:


x_range_slider = pn.widgets.RangeSlider(name='𝑥 axis range', 
                                        start=-100, end=100, 
                                        step=1,
                                        value=(-10,10),
                                        width=240)


# In[ ]:


a_slider = pn.widgets.FloatSlider(name='𝑎', 
                                  start=-100, 
                                  end=100, 
                                  step=1,
                                  value=0)


# In[ ]:


b_slider = pn.widgets.FloatSlider(name='𝑏', 
                                  start=-10, 
                                  end=10, 
                                  step=0.1,
                                  value=-1)


# In[ ]:


c_slider = pn.widgets.FloatSlider(name='𝑐', 
                                  start=-50, 
                                  end=50, 
                                  step=1,
                                  value=0)


# In[ ]:


d_slider = pn.widgets.FloatSlider(name='𝑑', 
                                  start=-50, 
                                  end=50, 
                                  step=1,
                                  value=1)


# In[ ]:


@pn.depends(x_range_slider.param.value,
            a_slider.param.value,
            b_slider.param.value,
            c_slider.param.value,
            d_slider.param.value)
def plot_logistic(x_range, a, b, c, d):
    X = np.linspace(x_range[0], x_range[1], 500)
    df = pd.DataFrame({"x": X})
    df["f(x)"] = four_param_logistic(X, a, b, c, d)
    plot = df.hvplot(kind="line",
                     x="x",
                     y="f(x)",
                     height=400,
                     width=600)
    plot.opts(hooks=[set_toolbar_autohide], toolbar = "above")
    return plot


# In[ ]:


widgets = pn.WidgetBox('# Parameters', c_slider, d_slider, a_slider, b_slider, 
                       width=250)


# In[ ]:


md1 = pn.pane.Markdown("The Four-Parameter Logistic (4PL) curve is defined as follows:")
description = r"""$$f(x) = c + \\frac{d - c}{1 + e^{b(x - a)}}$$"""
md2 = pn.pane.Markdown("""
Where:

- $$c$$ is the lower asymptote
- $$d$$ is the upper asymptote
- $$a$$ is usually known as the <em>mid-point</em>: the $$x$$ value producing a response half-way between $$c$$ and $$d$$
- $$b$$ is the slope around the mid-point. It can be positive or negative and, consequently, $$f(x)$$ may increase or decrease as $$x$$ increases
""")


# In[ ]:


dash = pn.Row(pn.Spacer(height=10, sizing_mode="stretch_width"),
              pn.Column(pn.pane.Markdown("# The Four-Parameter Logistic",
                                         sizing_mode="stretch_width",
                                         style={"text-align": "center"}),
                        md1,
                        pn.pane.Markdown(description, 
                                         sizing_mode="stretch_width",
                                         renderer='mathjax', 
                                         style={"text-align":"center"}),
                        md2,
                        pn.Row(pn.Column(x_range_slider, widgets, 
                                         sizing_mode="stretch_width"), 
                               plot_logistic)),
              pn.Spacer(height=10, sizing_mode="stretch_width"),
              sizing_mode="stretch_width")

dash.servable()

# In[ ]:






await write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.runPythonAsync(`
    import json

    state.curdoc.apply_json_patch(json.loads('${msg.patch}'), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads("""${msg.location}""")
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()
