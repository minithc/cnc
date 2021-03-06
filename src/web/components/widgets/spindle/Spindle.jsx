import _ from 'lodash';
import pubsub from 'pubsub-js';
import React from 'react';
import i18n from '../../../lib/i18n';
import controller from '../../../lib/controller';

class Spindle extends React.Component {
    state = {
        port: '',
        isCCWChecked: false,
        spindleSpeed: 0
    };

    componentDidMount() {
        this.subscribe();
    }
    componentWillUnmount() {
        this.unsubscribe();
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
    handleCCWChange() {
        this.setState({
            isCCWChecked: !(this.state.isCCWChecked)
        });
    }
    render() {
        const canClick = !!this.state.port;
        const cmd = this.state.isCCWChecked ? 'M4' : 'M3';
        const spindleSpeed = this.state.spindleSpeed;

        return (
            <div>
                <div className="btn-toolbar" role="toolbar">
                    <div className="btn-group btn-group-sm" role="group">
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => {
                                if (spindleSpeed > 0) {
                                    controller.writeln(cmd + ' S' + spindleSpeed);
                                } else {
                                    controller.writeln(cmd);
                                }
                            }}
                            title={i18n._('Start the spindle turning CW/CCW (M3/M4)')}
                            disabled={!canClick}
                        >
                            <i className="fa fa-play"></i>
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => controller.writeln('M5')}
                            title={i18n._('Stop the spindle from turning (M5)')}
                            disabled={!canClick}
                        >
                            <i className="fa fa-stop"></i>
                        </button>
                    </div>
                </div>
                <div className="checkbox" >
                    <label>
                        <input
                            type="checkbox"
                            checked={this.state.isCCWChecked}
                            onChange={::this.handleCCWChange}
                            disabled={!canClick}
                        />
                        &nbsp;{i18n._('Turn counterclockwise')}
                    </label>
                </div>
            </div>
        );
    }
}

export default Spindle;
