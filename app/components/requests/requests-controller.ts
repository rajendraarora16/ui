/// <reference path="../../../typings/tsd.d.ts" />
declare function require(name: string);

var idbWrapper = require('idb-wrapper');

import {UserService} from '../rest/user';
import {ServerService} from '../rest/server';
import {RequestTrackingService} from './request-tracking-svc';
import {UtilService} from '../rest/util';
import {RequestService} from '../rest/request';

export class RequestsController {
   private tasks;
   private alerts : Array<any>;
   private discoveredHosts : Array<any>;
   private discoveredHostsLength: number;
    static $inject: Array<string> = [
        '$scope',
        '$interval',
        '$timeout',
        '$log',
        'ServerService',
        'UtilService',
        'RequestService',
        'RequestTrackingService',
        'UserService'];

    constructor(private $scope: any,
        private $interval: ng.IIntervalService,
        private $timeout: ng.ITimeoutService,
        private $log: ng.ILogService,
        private serverSvc: ServerService,
        private utilSvc: UtilService,
        private requestSvc: RequestService,
        private requestTrackingService: RequestTrackingService,
        private userSvc: UserService) {
        this.alerts = [];
        this.tasks = {};
        this.discoveredHostsLength = 0;
        this.discoveredHosts = [];
        this.$interval(() => this.reloadDiscoveredHosts(), 5000);
        this.$interval(() => this.reloadAlerts(), 6000);
        this.$interval(() => this.reloadTasks(), 5000);
    }

    public reloadAlerts() {
        this.serverSvc.getList().then((hosts) => {
            var alerts = [];
            _.each(hosts, (host: any) => {
                if (host.node_status === 1) {
                    alerts.push('Host ' + host.node_name + ' is down');
                }
            });
            this.alerts = alerts;
        });
    }

    public reloadTasks() {
        this.requestTrackingService.getTrackedRequests().then((tasks) => {
            this.tasks = tasks;
        });
    }


    public logoutUser() {
        this.userSvc.logout().then((logout) => {
            document.location.href = '';
        });
    }

    public reloadDiscoveredHosts() {

        this.discoveredHosts = _.filter(this.discoveredHosts, (host: any) => {
            return host.state !== "ACCEPTED" && host.state !== "UNACCEPTED";
        });

        this.serverSvc.getDiscoveredHosts().then((freeHosts) => {

            this.discoveredHostsLength = freeHosts.length;

            _.each(freeHosts, (freeHost: any) => {
                var host = {
                    hostname: freeHost.node_name,
                    ipaddress: freeHost.management_ip,
                    state: "UNACCEPTED",
                    selected: false
                };

                var isPresent = false;

                isPresent = _.some(this.discoveredHosts, (dHost: any) => {
                    return dHost.hostname === host.hostname;
                });

                if (!isPresent) {
                    this.discoveredHosts.push(host);
                }
            });
        });
    }

    public acceptHost(host) {
        var hosts = {
            nodes: [
                {
                    node_name: host.hostname,
                    management_ip: host.ipaddress
                }
            ]
        }

        this.utilSvc.acceptHosts(hosts).then((result) => {
            this.$log.info(result);
            host.state = "ACCEPTING";
            host.task = result;
            var callback = () => {
                this.requestSvc.get(result).then((request) => {
                    if (request.status === 'FAILED' || request.status === 'FAILURE') {
                        this.$log.info('Failed to accept host in requests controller' + host.hostname);
                        host.state = "FAILED";
                        host.task = undefined;
                    }
                    else if (request.status === 'SUCCESS') {
                        this.$log.info('Accepted host in requests controller ' + host.hostname);
                        host.state = "ACCEPTED";
                        host.task = undefined;
                    }
                    else {
                        this.$log.info('Accepting host in requests controller' + host.hostname);
                        this.$timeout(callback, 5000);
                    }
                });
            }
            this.$timeout(callback, 5000);
        });
    }

    public openDiscoveredHostsModel() {
        document.getElementById("openDiscoveredHosts").click();
    }

    public acceptAllHosts() {
        _.each(this.discoveredHosts, (host: any) => {
            if (host.state === "UNACCEPTED") {
                this.acceptHost(host);
            }
        });
    }
}
    