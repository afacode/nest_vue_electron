// main process
import { app, BrowserWindow, contentTracing, globalShortcut, screen } from 'electron'
import { showNotification } from './native/main/notification'
import { createApplicationMenu, createMouseRigthMenu } from './native/main/menu'
import { createTray } from './native/main/tray'

let mainWindow:any = null
function createWindow(width: number = 800, height:number=600) {
  // 创建浏览器窗口
  const win = new BrowserWindow({
    width: width,
    height: height,
    webPreferences: {
      nodeIntegration: true, // 渲染进程可使用node api
      contextIsolation: false, // 关闭渲染进程的沙箱
      webSecurity: false // 关闭跨域检测
    },
    // backgroundColor: '#2e2c29',
    // show: false,
    // frame: false, // 无边框窗口
  })
  mainWindow = win

  // 加载 Vue 应用的 index.html 文件
  if (process.argv[2]) {
    // 打开开发者工具
    win.webContents.openDevTools()
    win.loadURL(process.argv[2])
  } else {
    win.loadFile('index.html')
  }
}
app.whenReady().then(() => {
  // 从Chromium收集追踪数据以找到性能瓶颈和慢操作
  // https://www.electronjs.org/zh/docs/latest/api/content-tracing
  (async ()=> {
    await contentTracing.startRecording({
      included_categories: ['*']
    })
    console.log('Tracing started')
    await new Promise(resolve => setTimeout(resolve, 5000))
    const path = await contentTracing.stopRecording()
    console.log('追踪数据记录到： ' + path)
  })()

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  createWindow(width-200, height-200)

  // app.isReady()
  // app.hide() isHidden()
  // app.show()

  createApplicationMenu()
  createMouseRigthMenu(mainWindow)
  createTray(mainWindow)

  registerGloablShortcut('CommandOrControl+X')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).then(() => {
  showNotification({title: '启动', body: '应用已经启动起来了'})
})

// 当所有的窗口都被关闭时触发
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

async function registerGloablShortcut(shortcut: string) : Promise<boolean>{
  const ret = globalShortcut.register(shortcut, () => {
    console.log(`${shortcut} is pressed`)
  })

  if (!ret) {
    console.log('registration failed')
  }

  // 检查快捷键是否注册成功
  console.log(globalShortcut.isRegistered(shortcut))
  return globalShortcut.isRegistered(shortcut)
}
