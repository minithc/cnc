import _ from 'lodash';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import React from 'react';
import i18n from '../../../lib/i18n';
import controller from '../../../lib/controller';
import { in2mm, mm2in } from '../../../lib/units';
import ToolbarButton from './ToolbarButton';
import store from '../../../store';
import {
    IMPERIAL_UNIT,
    METRIC_UNIT,
    ACTIVE_STATE_IDLE
} from './constants';

class Probe extends React.Component {
    state = {
        port: '',
        unit: METRIC_UNIT,
        activeState: ACTIVE_STATE_IDLE,
        probeCommand: store.get('widgets.probe.probeCommand'),
        probeDepth: this.toUnitValue(METRIC_UNIT, store.get('widgets.probe.probeDepth')),
        probeFeedrate: this.toUnitValue(METRIC_UNIT, store.get('widgets.probe.probeFeedrate')),
        tlo: this.toUnitValue(METRIC_UNIT, store.get('widgets.probe.tlo')),
        retractionDistance: this.toUnitValue(METRIC_UNIT, store.get('widgets.probe.retractionDistance'))
    };
    controllerEvents = {
        'grbl:status': (data) => {
            if (data.activeState === this.state.activeState) {
                return;
            }

            this.setState({
                activeState: data.activeState
            });
        },
        'grbl:parserstate': (parserstate) => {
            const { unit } = this.state;
            let nextUnit = unit;

            // Imperial
            if (parserstate.modal.units === 'G20') {
                nextUnit = IMPERIAL_UNIT;
            }

            // Metric
            if (parserstate.modal.units === 'G21') {
                nextUnit = METRIC_UNIT;
            }

            if (nextUnit === unit) {
                return;
            }

            // Set `this.unitDidChange` to true if the unit has changed
            this.unitDidChange = true;

            let {
                probeDepth,
                probeFeedrate,
                tlo,
                retractionDistance
            } = store.get('widgets.probe');

            // unit conversion
            if (nextUnit === IMPERIAL_UNIT) {
                probeDepth = mm2in(probeDepth).toFixed(4) * 1;
                probeFeedrate = mm2in(probeFeedrate).toFixed(4) * 1;
                tlo = mm2in(tlo).toFixed(4) * 1;
                retractionDistance = mm2in(retractionDistance).toFixed(4) * 1;
            }
            if (nextUnit === METRIC_UNIT) {
                probeDepth = Number(probeDepth).toFixed(3) * 1;
                probeFeedrate = Number(probeFeedrate).toFixed(3) * 1;
                tlo = Number(tlo).toFixed(3) * 1;
                retractionDistance = Number(retractionDistance).toFixed(3) * 1;
            }
            this.setState({
                unit: nextUnit,
                probeDepth,
                probeFeedrate,
                tlo,
                retractionDistance
            });
        }
    };
    unitDidChange = false;

    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();
    }
    componentWillUnmount() {
        this.unsubscribe();
        this.removeControllerEvents();
    }
    shouldComponentUpdate(nextProps, nextState) {
        return ! _.isEqual(nextState, this.state);
    }
    componentDidUpdate(prevProps, prevState) {
        // Do not save to store if the unit did change between in and mm
        if (this.unitDidChange) {
            this.unitDidChange = false;
            return;
        }

        const { unit, probeCommand } = this.state;
        let {
            probeDepth,
            probeFeedrate,
            tlo,
            retractionDistance
        } = this.state;

        if (unit === IMPERIAL_UNIT) {
            probeDepth = in2mm(probeDepth);
            probeFeedrate = in2mm(probeFeedrate);
            tlo = in2mm(tlo);
            retractionDistance = in2mm(retractionDistance);
        }

        // To save in mm
        store.set('widgets.probe.probeCommand', probeCommand);
        store.set('widgets.probe.probeDepth', Number(probeDepth));
        store.set('widgets.probe.probeFeedrate', Number(probeFeedrate));
        store.set('widgets.probe.tlo', Number(tlo));
        store.set('widgets.probe.retractionDistance', Number(retractionDistance));
    }
    subscribe() {
        this.pubsubTokens = [];

        { // port
            const token = pubsub.subscribe('port', (msg, port) => {
                port = port || '';
                this.setState({ port });
            });
            this.pubsubTokens.push(token);
        }
    }
    unsubscribe() {
        _.each(this.pubsubTokens, (token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }
    addControllerEvents() {
        _.each(this.controllerEvents, (callback, eventName) => {
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents() {
        _.each(this.controllerEvents, (callback, eventName) => {
            controller.off(eventName, callback);
        });
    }
    changeProbeCommand(value) {
        this.setState({ probeCommand: value });
    }
    handleProbeDepthChange(event) {
        const probeDepth = event.target.value;
        this.setState({ probeDepth });
    }
    handleProbeFeedrateChange(event) {
        const probeFeedrate = event.target.value;
        this.setState({ probeFeedrate });
    }
    handleTLOChange(event) {
        const tlo = event.target.value;
        this.setState({ tlo });
    }
    handleRetractionDistanceChange(event) {
        const retractionDistance = event.target.value;
        this.setState({ retractionDistance });
    }
    sendGCode(gcode, params) {
        const s = _.map(params, (value, letter) => String(letter + value)).join(' ');
        const msg = (s.length > 0) ? (gcode + ' ' + s) : gcode;
        controller.writeln(msg);
    }
    runZProbe() {
        const { probeCommand, probeDepth, probeFeedrate, tlo, retractionDistance } = this.state;
        const towardWorkpiece = _.includes(['G38.2', 'G38.3'], probeCommand);

        // Cancel Tool Length Offset (TLO)
        this.sendGCode('G49');

        // Set relative distance mode
        this.sendGCode('G91');

        // Start Z-probing
        this.sendGCode(probeCommand, {
            Z: towardWorkpiece ? -probeDepth : probeDepth,
            F: probeFeedrate
        });

        // Set back to asolute distance mode
        this.sendGCode('G90');

        // Zero out work z axis
        this.sendGCode('G10', {
            L: 20,
            P: 1,
            Z: 0
        });

        // Set TLO to the height of touch plate
        this.sendGCode('G43.1', {
            Z: -tlo
        });

        // Set relative distance mode
        this.sendGCode('G91');

        // Retract slightly from the touch plate
        this.sendGCode('G0', {
            Z: retractionDistance
        });

        // Set back to asolute distance mode
        this.sendGCode('G90');
    }
    toUnitValue(unit, val) {
        val = Number(val) || 0;
        if (unit === IMPERIAL_UNIT) {
            val = mm2in(val).toFixed(4) * 1;
        }
        if (unit === METRIC_UNIT) {
            val = val.toFixed(3) * 1;
        }

        return val;
    }
    render() {
        const { port, unit, activeState } = this.state;
        const { probeCommand, probeDepth, probeFeedrate, tlo, retractionDistance } = this.state;
        const displayUnit = (unit === METRIC_UNIT) ? i18n._('mm') : i18n._('in');
        const feedrateUnit = (unit === METRIC_UNIT) ? i18n._('mm/min') : i18n._('in/mm');
        const step = (unit === METRIC_UNIT) ? 1 : 0.1;
        const canClick = (!!port && (activeState === ACTIVE_STATE_IDLE));
        const classes = {
            'G38.2': classNames(
                'btn',
                'btn-default',
                { 'btn-select': probeCommand === 'G38.2' }
            ),
            'G38.3': classNames(
                'btn',
                'btn-default',
                { 'btn-select': probeCommand === 'G38.3' }
            ),
            'G38.4': classNames(
                'btn',
                'btn-default',
                { 'btn-select': probeCommand === 'G38.4' }
            ),
            'G38.5': classNames(
                'btn',
                'btn-default',
                { 'btn-select': probeCommand === 'G38.5' }
            )
        };

        return (
            <div>
                <ToolbarButton
                    port={port}
                    activeState={activeState}
                />
                <div className="form-group">
                    <label className="control-label">{i18n._('Probe Command')}</label>
                    <div className="btn-toolbar" role="toolbar">
                        <div className="btn-group btn-group-xs">
                            <button
                                type="button"
                                className={classes['G38.2']}
                                title={i18n._('G38.2 probe toward workpiece, stop on contact, signal error if failure')}
                                onClick={() => this.changeProbeCommand('G38.2')}
                            >
                                G38.2
                            </button>
                            <button
                                type="button"
                                className={classes['G38.3']}
                                title={i18n._('G38.3 probe toward workpiece, stop on contact')}
                                onClick={() => this.changeProbeCommand('G38.3')}
                            >
                                G38.3
                            </button>
                            <button
                                type="button"
                                className={classes['G38.4']}
                                title={i18n._('G38.4 probe away from workpiece, stop on loss of contact, signal error if failure')}
                                onClick={() => this.changeProbeCommand('G38.4')}
                            >
                                G38.4
                            </button>
                            <button
                                type="button"
                                className={classes['G38.5']}
                                title={i18n._('G38.5 probe away from workpiece, stop on loss of contact')}
                                onClick={() => this.changeProbeCommand('G38.5')}
                            >
                                G38.5
                            </button>
                        </div>
                    </div>
                    <p className="probe-command-description">
                    {probeCommand === 'G38.2' &&
                        <i>{i18n._('G38.2 probe toward workpiece, stop on contact, signal error if failure')}</i>
                    }
                    {probeCommand === 'G38.3' &&
                        <i>{i18n._('G38.3 probe toward workpiece, stop on contact')}</i>
                    }
                    {probeCommand === 'G38.4' &&
                        <i>{i18n._('G38.4 probe away from workpiece, stop on loss of contact, signal error if failure')}</i>
                    }
                    {probeCommand === 'G38.5' &&
                        <i>{i18n._('G38.5 probe away from workpiece, stop on loss of contact')}</i>
                    }
                    </p>
                </div>
                <div className="container-fluid">
                    <div className="row no-gutter probe-options">
                        <div className="col-xs-6">
                            <div className="form-group">
                                <label className="control-label">{i18n._('Probe Depth')}</label>
                                <div className="input-group input-group-xs">
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={probeDepth}
                                        placeholder="0.00"
                                        min={0}
                                        step={step}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        onChange={::this.handleProbeDepthChange}
                                    />
                                    <div className="input-group-addon">{displayUnit}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xs-6">
                            <div className="form-group">
                                <label className="control-label">{i18n._('Probe Feedrate')}</label>
                                <div className="input-group input-group-xs">
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={probeFeedrate}
                                        placeholder="0.00"
                                        min={0}
                                        step={step}
                                        onChange={::this.handleProbeFeedrateChange}
                                    />
                                    <span className="input-group-addon">{feedrateUnit}</span>
                                </div>
                            </div>
                        </div>
                        <div className="col-xs-6">
                            <div className="form-group">
                                <label className="control-label">{i18n._('Touch Plate Thickness')}</label>
                                <div className="input-group input-group-xs">
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={tlo}
                                        placeholder="0.00"
                                        min={0}
                                        step={step}
                                        onChange={::this.handleTLOChange}
                                    />
                                    <span className="input-group-addon">{displayUnit}</span>
                                </div>
                            </div>
                        </div>
                        <div className="col-xs-6">
                            <div className="form-group">
                                <label className="control-label">{i18n._('Retraction Distance')}</label>
                                <div className="input-group input-group-xs">
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={retractionDistance}
                                        placeholder="0.00"
                                        min={0}
                                        step={step}
                                        onChange={::this.handleRetractionDistanceChange}
                                    />
                                    <span className="input-group-addon">{displayUnit}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="row no-gutter">
                        <div className="col-xs-12">
                            <div className="btn-toolbar">
                                <div className="btn-group" role="group">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-default"
                                        onClick={::this.runZProbe}
                                        disabled={!canClick}
                                    >
                                        {i18n._('Run Z-probe')}
                                    </button>
                                </div>
                                <div className="btn-group" role="group"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Probe;
