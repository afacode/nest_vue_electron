
import { isUrl, uniqueSlash } from '@/plugins/utils/utils';
import { Result } from 'ant-design-vue';
import type { RouteRecordRaw } from 'vue-router';
import {baseRouter as common} from './index'
import RouterView from '@/layout/routerView/index.vue';
import router, { routes, outsideLayout } from '@/router';
import NotFound from '@/views/error/404.vue';
import {useRouteFiles} from './constant'
import { asyncRoutes } from './asyncModules';
// 需要放在所有路由之后的路由
const endRoutes: RouteRecordRaw[] = [];
// const endRoutes: RouteRecordRaw[] = [REDIRECT_ROUTE, errorRoute, notFound];
// auto load

export function filterAsyncRoute(
  routes: API.Menu[],
  parentRoute: API.Menu | null = null,
  lastNamePath: string[] = [],
): RouteRecordRaw[] {
  return routes
    .filter((item) => item.type !== 2 && item.isShow && item.parentId == parentRoute?.id)
    .map((item) => {
      const { router, viewPath, name, icon, orderNum, keepalive, isExt, openMode } = item;
      let fullPath = '';
      const pathPrefix = lastNamePath.at(-1) || '';
      if (isUrl(router)) {
        fullPath = router;
      } else {
        fullPath = router.startsWith('/') ? router : `/${router}`;
        fullPath = router.startsWith(pathPrefix) ? fullPath : pathPrefix + fullPath;
        fullPath = [...new Set(uniqueSlash(fullPath).split('/'))].join('/');
      }
      let realRoutePath = router;
      if (parentRoute) {
        if (fullPath.startsWith(parentRoute?.router)) {
          realRoutePath = fullPath.split(parentRoute.router)[1];
        } else if (!isUrl(parentRoute.router) && !isUrl(router)) {
          realRoutePath = router;
        }
      }
      realRoutePath = realRoutePath.startsWith('/') ? realRoutePath.slice(1) : realRoutePath;
      realRoutePath = realRoutePath.replace(/http(s)?:\/\//, '');
      const route: Partial<RouteRecordRaw> = {
        path: realRoutePath,
        // name: `${viewPath ? toHump(viewPath) : fullPath}-${item.id}`,
        name: fullPath,
        meta: {
          orderNum,
          isExt,
          openMode,
          icon,
          title: name,
          type: item.type,
          perms: [],
          namePath: lastNamePath.concat(fullPath),
          keepAlive: keepalive,
        },
      };

      // 如果是目录
      if (item.type === 0) {
        const children = filterAsyncRoute(routes, item, lastNamePath.concat(fullPath));
        if (children?.length) {
          route.component = RouterView;
          route.children = children;
          route.redirect = { name: children[0].name };
        } else {
          route.component = ('目录类型菜单不是真实页面')
          // route.component = (
          //   <Result
          //     status="500"
          //     title={name}
          //     sub-title="目录类型菜单不是真实页面，请为当前目录添加页面级子菜单或更改当前菜单类型."
          //   ></Result>
          // );
        }
        return route;
        // 如果是页面
      } else if (item.type === 1) {
        const Component =
          isExt && openMode === 2 ? (
            null
            // <IFramePage src={fullPath} />
          ) : (
            asyncRoutes[viewPath] || NotFound
          );
        console.log(viewPath, 'asyncRoutes[viewPath]')
        route.component = Component;
          
        const perms = routes
          .filter((n) => n.parentId === item.id)
          .flatMap((n) => n.perms?.split(','));
      
        if (route.meta && perms) {
          // 设置当前页面所拥有的权限
          route.meta.perms = perms // as PermissionType[];
        }
        return route;
      }
      return undefined;
    })
    .filter((item): item is RouteRecordRaw => !!item);
}

export const generatorDynamicRouter = (asyncMenus: API.Menu[]) => {
  try {
    // console.log('asyncMenus', asyncMenus);
    console.log(useRouteFiles(), '99999999')
    console.log(asyncRoutes, '8888888')
    const routeList = filterAsyncRoute(asyncMenus);
    const layout = routes.find((item) => item.name == 'Layout')!;
    // console.log(routeList, '根据后端返回的权限路由生成');
    // 给公共路由添加namePath
    generatorNamePath(common);
    const menus = [...common, ...routeList, ...endRoutes];
    layout.children = menus;
    const removeRoute = router.addRoute(layout);
    // 获取所有没有包含children的路由，上面addRoute的时候，vue-router已经帮我们拍平了所有路由
    const filterRoutes = router
      .getRoutes()
      .filter(
        (item) =>
          (!item.children.length || Object.is(item.meta?.hideChildrenInMenu, true)) &&
          !outsideLayout.some((n) => n.name === item.name),
      );
    // 清空所有路由
    removeRoute();
    layout.children = [...filterRoutes];
    // 重新添加拍平后的路由
    router.addRoute(layout);
    console.log('所有路由', router.getRoutes());

    return Promise.resolve({
      menus,
      routes: layout.children,
    });
  } catch (error) {
    console.error('生成路由时出错', error);
    return Promise.reject(`生成路由时出错: ${error}`);
  }
};

/**
 * 主要方便于控制a-menu的open-keys，即控制左侧菜单应当展开哪些菜单
 * @param {RouteRecordRaw[]} routes 需要添加namePath的路由
 * @param {string[]} namePath
 */
 export const generatorNamePath = (
  routes: RouteRecordRaw[],
  namePath?: string[],
  parent?: RouteRecordRaw,
) => {
  routes.forEach((item) => {
    if (item.meta && typeof item.name === 'string') {
      item.meta.namePath = Array.isArray(namePath) ? namePath.concat(item.name) : [item.name];
      item.meta.fullPath = parent?.meta?.fullPath
        ? [parent.meta.fullPath, item.path].join('/')
        : item.path;
      item.meta.fullPath = uniqueSlash(item.meta.fullPath);

      if (item.children?.length) {
        generatorNamePath(item.children, item.meta.namePath, item);
      }
    }
  });
};