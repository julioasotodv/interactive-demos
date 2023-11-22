importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading, please wait...'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/0.14.0/dist/wheels/bokeh-2.4.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/0.14.0/dist/wheels/panel-0.14.0-py3-none-any.whl', 'holoviews==1.15.1', 'hvplot==0.8.2', 'numpy', 'pandas', 'scipy']
  for (const pkg of env_spec) {
    const pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    self.postMessage({type: 'status', msg: `Loading, please wait...`})
    await self.pyodide.runPythonAsync(`
      import micropip
      await micropip.install('${pkg}');
    `);
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Loading, please wait...'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

#!/usr/bin/env python
# coding: utf-8

# In[ ]:


css = """
body{
    overflow-x: hidden !important;
}
"""


# In[ ]:


import panel as pn
pn.extension("katex", "mathjax", css_files=["style.css"])


# In[ ]:


import numpy as np
import pandas as pd
import holoviews as hv
from holoviews import opts, Cycle
hv.extension('bokeh')


# In[ ]:


import hvplot.pandas
from scipy import stats


# In[ ]:


# These names have to go out as Panel convert does not like them:
mean_x = pn.widgets.FloatSlider(name='μ𝑥', start=-5.0, end=5.0, step=0.5, value=0)
mean_y = pn.widgets.FloatSlider(name='μ𝑦', start=-5, end=5, step=0.5, value=0)

var_x = pn.widgets.FloatSlider(name='σ²𝑥', start=1, end=15, step=0.5)
var_y = pn.widgets.FloatSlider(name='σ²𝑦', start=1, end=15, step=0.5)

cov_x_y = pn.widgets.FloatSlider(name='Cov(𝑥,𝑦)', start=-0.95, end=0.95, step=0.05, value=0)


# In[ ]:


from bokeh.models import Range1d
seed = 1234

def hook(plot, element):
    plot.state.x_range = Range1d(-10, 10, bounds="auto")
    plot.state.y_range = Range1d(-10, 10, bounds="auto")
    plot.state.toolbar.active_drag = None
    plot.state.toolbar.active_scroll = None

def hook2(plot, element):
    plot.state.x_range = Range1d(-10, 10, bounds="auto")
    plot.state.toolbar.active_drag = None
    plot.state.toolbar.active_scroll = None
    plot.state.yaxis.axis_line_color = None
    plot.state.yaxis.major_tick_line_color = None
    plot.state.yaxis.minor_tick_line_color = None
    plot.state.yaxis.major_label_text_color = None
    
def hook3(plot, element):
    plot.state.y_range = Range1d(-10, 10, bounds="auto")
    plot.state.toolbar.active_drag = None
    plot.state.toolbar.active_scroll = None
    plot.state.xaxis.axis_line_color = None
    plot.state.xaxis.major_tick_line_color = None
    plot.state.xaxis.minor_tick_line_color = None
    plot.state.xaxis.major_label_text_color = None
    
@pn.depends(mean_x.param.value, mean_y.param.value, var_x.param.value, var_y.param.value, cov_x_y.param.value)
def create_scatter(m_x, m_y, var_x, var_y, cov_x_y):
    mvn = stats.multivariate_normal(mean=[m_x, m_y],
                                      cov=[[var_x, cov_x_y], 
                                           [cov_x_y, var_y]])
    sample = pd.DataFrame(mvn.rvs(size=500),
                          columns=["x", "y"])
    scatter = sample.hvplot(kind="scatter", x="x", y="y",
                            height=400,
                            width=600,
                            xlim=(-10,10),
                            ylim=(-10,10),
                            xlabel=r"𝑥",
                            ylabel=r"𝑦")
    scatter.opts(hooks=[hook])
    kde_x = sample.hvplot(kind="kde", y="x", hover=False, ylabel="", xlabel=r"𝑥", width=600, height=125)
    kde_x.opts(hooks=[hook2])
    kde_y = sample.hvplot(kind="kde", y="y", hover=False, ylabel="", xlabel=r"𝑦", width=125, height=400)
    kde_y.opts(hooks=[hook3])
    comp = scatter << kde_y << kde_x
    comp.opts(toolbar=None)
    return comp

@pn.depends(mean_x.param.value, mean_y.param.value, var_x.param.value, var_y.param.value, cov_x_y.param.value)
def create_latex(m_x, m_y, var_x, var_y, cov_x_y):
    latex = pn.pane.LaTeX(r"$\\mathbf{m}=\\begin{bmatrix} %s \\\\ %s \\end{bmatrix} \\quad \\mathbf{C}=\\begin{bmatrix}%s & %s\\\\%s & %s\\end{bmatrix}$" % 
                          (round(m_x, 2), round(m_y,2), round(var_x,2), round(cov_x_y,2), round(cov_x_y,2), round(var_y,2)),
                         style={"text-align":"center"}, sizing_mode="stretch_width", renderer='katex')
    return latex


# In[ ]:


widgets = pn.WidgetBox('## Parameters', mean_x, mean_y, var_x, var_y, cov_x_y, width=250)


description = r"""The Multivariate Normal distribution, Multivariate Gaussian distribution 
or Joint Normal Distribution is a generalization of the one-dimensional (univariate) 
normal distribution to higher dimensions ($n$-dimensional).<br><br>In the example below, we have two dimensions ($x$ and $y$).
A Multivariate Normal (commonly abbreviated as <em>MVN</em>) distribution $X$ can be completely defined by two parameters: $$X \\sim \\mathcal{N}(\\mathbf{m}, \\mathbf{C})$$
Where $\\mathbf{m}$ is a $n$-dimensional <em>mean vector</em> (this is, a vector with the means for $x$ and $y$ in this example): $$\\mathbf{m}=\\begin{bmatrix} \\mu_x \\\\ \\mu_y \\end{bmatrix}$$
And $\\mathbf{C}$ is a $n \\times n$ <em>covariance matrix</em> in the 
form of: $$\\mathbf{C}=\\begin{bmatrix}\\sigma^2_x & \\mathrm{Cov}(x, y) \\\\ \\mathrm{Cov}(y, x)  & \\sigma^2_y \\end{bmatrix}$$
Where $\\sigma^2$ is the variance, and $\\mathrm{Cov}(x, y)$ is the covariance between the two variables. Given that $\\mathrm{Cov}(x, y) = \\mathrm{Cov}(y, x)$, 
$\\mathbf{C}$ is always symmetric."""


# In[ ]:


flexbox = pn.layout.FlexBox(*[widgets, create_scatter], justify_content="center")


# In[ ]:


dash = pn.Column(pn.pane.Markdown("# The Multivariate Normal", sizing_mode="stretch_width", style={"text-align":"center"}),
                 pn.pane.LaTeX(description, sizing_mode="stretch_width", renderer='mathjax', 
                               style={"text-align":"center"},
                               margin=(5,5,20,5)),
                 pn.pane.Markdown("### Example", sizing_mode="stretch_width", style={"text-align":"center"}),
                 create_latex,
                 flexbox,
                sizing_mode="stretch_width")


# In[ ]:


dash.servable()


# In[ ]:






await write_doc()
  `
  const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
  self.postMessage({
    type: 'render',
    docs_json: docs_json,
    render_items: render_items,
    root_ids: root_ids
  });
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
