import sys, getopt
import win32com.client

ps = win32com.client.Dispatch("Photoshop.Application")
# test = win32com.client.Dispatch("Photoshop.JPEGSaveOptions")

ps.Open(sys.argv[1:][0])

ps.bringToFront()
