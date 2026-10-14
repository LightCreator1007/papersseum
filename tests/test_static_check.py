from papersseum.security.static_check import scan_source


def _kinds(src):
    return {v["kind"] + ":" + v["detail"] for v in scan_source(src)["violations"]}


def test_clean_agent_passes():
    src = ("import numpy as np\nimport math\n"
           "from papersseum import Agent\n"
           "class Agent(Agent):\n    def act(self, obs):\n        return int(np.argmax([1,2,3]) % 3)\n")
    assert scan_source(src)["ok"]


def test_banned_import_rejected():
    r = scan_source("import os\n")
    assert not r["ok"]
    assert any("os" in v["detail"] for v in r["violations"])


def test_banned_builtins_rejected():
    for bad in ("eval('1')", "exec('x=1')", "open('/etc/passwd')", "__import__('os')"):
        assert not scan_source(bad + "\n")["ok"], bad


def test_star_import_rejected():
    assert not scan_source("from numpy import *\n")["ok"]


def test_dunder_escape_rejected():
    assert not scan_source("x = ().__class__.__bases__\n")["ok"]      # __bases__ banned
    assert not scan_source("y = object().__subclasses__()\n")["ok"]


def test_allowed_scientific_imports_ok():
    assert scan_source("import numpy\nimport math\nimport random\nimport collections\n")["ok"]


def test_blocks_introspection_and_raw_loaders():
    from papersseum.security.static_check import scan_source
    for src in ('getattr(x, "a")', "vars(x)",
                "import numpy as np\nnp.load('f')",
                "import numpy as np\nnp.fromfile('f')",
                "import numpy\nnumpy.lib.npyio.fromfile('f')"):
        assert not scan_source(src)["ok"], src
    assert scan_source("import numpy as np\nnp.zeros(3)\nimport json\njson.loads('1')")["ok"]


def test_torch_and_load_weights_have_clear_reasons():
    from papersseum.security.static_check import scan_source
    r = scan_source("import torch\n")
    assert not r["ok"] and "papersseum.nn" in r["violations"][0]["detail"]
    r = scan_source("from papersseum import load_weights\ndef f(c):\n    return load_weights(c, 'w.npy')\n")
    assert not r["ok"] and r["violations"][0]["kind"] == "weights"
    assert scan_source("from papersseum import nn, unpack_weights\nW = unpack_weights('')\n")["ok"]
