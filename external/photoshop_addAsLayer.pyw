import sys, getopt

""" import win32com.client

ps = win32com.client.Dispatch("Photoshop.Application")
# test = win32com.client.Dispatch("Photoshop.JPEGSaveOptions")

print(sys.argv[1:][0])

doc = ps.Application.ActiveDocument
# imgDoc = ps.Open(sys.argv[1:][0])
imgDoc = ps.Open("C:/Users/Matmusia/AppData/Local/Temp/LV_temp_img.jpg", None, None)

layer = imgDoc.ArtLayers.Item(1)
layer.Copy()
imgDoc.Close()

doc.Paste()

ps.bringToFront() """

from photoshop import Session

with Session() as ps:
    desc = ps.ActionDescriptor
    desc.putPath(
        ps.app.charIDToTypeID("null"),
        sys.argv[1:][0],
    )
    event_id = ps.app.charIDToTypeID("Plc ")  # `Plc` need one space in here.
    ps.app.executeAction(ps.app.charIDToTypeID("Plc "), desc)

    ps.app.bringToFront()
